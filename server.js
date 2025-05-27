const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const session = require('express-session');
const RedisStore = require('connect-redis').default;
const redis = require('redis');
const crypto = require('crypto'); // 用于生成唯一文件名

// 创建Redis客户端
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => {
  console.error('Redis连接错误:', err);
});

redisClient.on('connect', () => {
  console.log('Redis连接成功');
});

// 连接Redis
redisClient.connect().catch(console.error);

// 读取配置文件（登录凭据）
const configPath = path.join(__dirname, 'config.json');
let config = require(configPath);

// 检查认证配置是否已重置
function isAuthReset(authConfig) {
  return (!authConfig.username || authConfig.username.trim() === '') &&
         (!authConfig.hashedPassword || authConfig.hashedPassword.trim() === '');
}

// 监听配置文件变化
fs.watchFile(configPath, (curr, prev) => {
  if (curr.mtime !== prev.mtime) {
    try {
      // 检查文件是否存在
      if (fs.existsSync(configPath)) {
        // 保存当前的API配置
        const currentApiConfig = config.api;
        
        // 重新读取配置文件
        delete require.cache[configPath];
        const newConfig = require(configPath);
        
        // 检查认证信息是否被重置
        if (isAuthReset(newConfig.auth)) {
          console.log('检测到认证信息被重置');
          // 重置认证信息，但保留其他配置
          config = {
            auth: {
              isConfigured: false,
              username: '',
              hashedPassword: '',
              salt: ''  // 为了安全，当认证信息重置时，也重置salt
            },
            api: currentApiConfig  // 保留原有的API配置
          };
          // 保存更新后的配置
          saveConfig();
          console.log('认证信息已重置，其他配置保持不变');
        } else {
          // 如果认证信息没有被重置，直接使用新的配置
          config = newConfig;
          console.log('配置文件已更新');
        }
      } else {
        // 如果文件不存在，创建默认配置
        config = {
          auth: {
            isConfigured: false,
            username: '',
            hashedPassword: '',
            salt: ''
          },
          api: {
            enabled: true,
            tokens: [],
            defaultFormat: 'original'
          }
        };
        // 保存默认配置
        saveConfig();
        console.log('配置文件已重置为默认状态');
      }
    } catch (error) {
      console.error('更新配置文件时发生错误:', error);
    }
  }
});

// 保存配置文件的函数
function saveConfig() {
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

// 密码加密相关函数
function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

const app = express();
const port = process.env.PORT || 3000;

// 配置 express 解析表单数据
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 配置 session 中间件（生产环境中请将 secret 设置为安全的随机串，并完善更多安全配置）
app.use(session({
  secret: 'somesecret',
  resave: false,
  saveUninitialized: false,
  store: new RedisStore({ client: redisClient })
}));

// 检查是否需要初始配置的中间件
function checkInitialSetup(req, res, next) {
  if (!config.auth.isConfigured && req.path !== '/setup' && req.path !== '/perform-setup') {
    return res.redirect('/setup');
  }
  next();
}

// 鉴权中间件，检测用户是否登录
function isAuthenticated(req, res, next) {
  if (req.session.authenticated) {
    next();
  } else {
    res.redirect('/login');
  }
}

// API鉴权中间件，检测请求是否包含有效的API令牌
function apiAuthenticated(req, res, next) {
  const token = req.headers['x-api-token'] || req.query.token;
  
  if (!token) {
    return res.status(401).json({ success: false, message: '缺少API令牌' });
  }
  
  if (!config.api.enabled) {
    return res.status(403).json({ success: false, message: 'API功能未启用' });
  }
  
  const validToken = config.api.tokens.find(t => t.token === token);
  if (!validToken) {
    return res.status(401).json({ success: false, message: '无效的API令牌' });
  }
  
  // 将API令牌信息添加到请求对象中，以便后续使用
  req.apiToken = validToken;
  next();
}

// 公共静态资源（CSS、JS等）
// 注意：不再直接暴露 /uploads 目录，而是通过 /i 路由隐藏真实根目录
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));
// 对于上传后的图片，设置静态资源路由，添加 AVIF MIME 类型支持
app.use('/i', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: function (res, filePath) {
    if (filePath.endsWith('.avif')) {
      res.setHeader('Content-Type', 'image/avif');
    }
  }
}));

// 使用内存存储，以便后续利用 sharp 进行图片转换
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const allowedMimetypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];
    if (allowedMimetypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件格式'), false);
    }
  }
});

// 确保目录存在的函数
function ensureDirExistence(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

// 获取当前日期的年月日文件夹路径
function getYearMonthPath() {
  const now = new Date();
  const year = now.getFullYear().toString();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  return path.join(year, month, day);
}

// 递归获取目录下所有文件
function getAllFiles(dir, fileList = []) {
  if (fs.existsSync(dir)) {
    const files = fs.readdirSync(dir);
    files.forEach(file => {
      const filePath = path.join(dir, file);
      if (fs.statSync(filePath).isDirectory()) {
        getAllFiles(filePath, fileList);
      } else {
        fileList.push(filePath);
      }
    });
  }
  return fileList;
}

// 递归清理空文件夹
function cleanEmptyDirs(dir) {
  if (!fs.existsSync(dir)) return;

  let files = fs.readdirSync(dir);
  
  for (let file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      cleanEmptyDirs(fullPath);
    }
  }

  // 重新读取文件列表，因为可能在递归清理子目录时已经删除了一些内容
  files = fs.readdirSync(dir);
  
  // 如果目录为空，且不是uploads根目录，则删除它
  if (files.length === 0 && dir !== path.join(__dirname, 'uploads')) {
    try {
      fs.rmdirSync(dir);
      console.log('已清理空文件夹:', dir);
    } catch (err) {
      console.error('清理空文件夹失败:', dir, err);
    }
  }
}

// 确保上传目录存在
ensureDirExistence(path.join(__dirname, 'uploads'));
// 确保API上传目录存在
ensureDirExistence(path.join(__dirname, 'uploads', 'api'));

// 生成随机API令牌的函数
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

/* ---------------- 初始设置相关路由 ---------------- */

// 初始设置页面
app.get('/setup', (req, res) => {
  if (config.auth.isConfigured) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'views', 'setup.html'));
});

// 执行初始设置
app.post('/perform-setup', (req, res) => {
  if (config.auth.isConfigured) {
    return res.status(400).json({ success: false, message: '系统已经配置过了' });
  }

  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ success: false, message: '用户名和密码都是必需的' });
  }

  const salt = generateSalt();
  const hashedPassword = hashPassword(password, salt);

  config.auth.username = username;
  config.auth.hashedPassword = hashedPassword;
  config.auth.salt = salt;
  config.auth.isConfigured = true;

  saveConfig();
  
  // 自动登录
  req.session.authenticated = true;
  res.json({ success: true, message: '初始设置完成' });
});

/* ---------------- 登录相关路由 ---------------- */

// 登录页面
app.get('/login', checkInitialSetup, (req, res) => {
  if (req.session.authenticated) {
    return res.redirect('/');
  }
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// 登录处理
app.post('/login', checkInitialSetup, (req, res) => {
  const { username, password } = req.body;
  const hashedPassword = hashPassword(password, config.auth.salt);
  
  if (username === config.auth.username && hashedPassword === config.auth.hashedPassword) {
    req.session.authenticated = true;
    return res.json({ success: true });
  } else {
    return res.status(401).json({ success: false, message: '用户名或密码错误' });
  }
});

// 注销
app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/login');
});

// 受保护的首页（图床主页面）
app.get('/', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

// 健康检查端点
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

/* ---------------- API管理相关路由 ---------------- */

// API管理页面
app.get('/api-management', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'api-management.html'));
});

// 获取所有API令牌
app.get('/api/tokens', isAuthenticated, (req, res) => {
  res.json({
    success: true, 
    enabled: config.api.enabled,
    tokens: config.api.tokens,
    defaultFormat: config.api.defaultFormat
  });
});

// 切换API启用状态
app.post('/api/toggle', isAuthenticated, (req, res) => {
  config.api.enabled = !config.api.enabled;
  saveConfig();
  res.json({
    success: true, 
    enabled: config.api.enabled
  });
});

// 设置API默认格式
app.post('/api/format', isAuthenticated, (req, res) => {
  const { format } = req.body;
  
  if (!['original', 'webp', 'avif'].includes(format)) {
    return res.status(400).json({ 
      success: false, 
      message: '无效的格式选项' 
    });
  }
  
  config.api.defaultFormat = format;
  saveConfig();
  
  res.json({
    success: true,
    format: format
  });
});

// 创建新的API令牌
app.post('/api/tokens', isAuthenticated, (req, res) => {
  const { name, expiresAt } = req.body;
  
  if (!name) {
    return res.status(400).json({ success: false, message: '令牌名称不能为空' });
  }
  
  const newToken = {
    id: Date.now().toString(),
    name: name,
    token: generateToken(),
    createdAt: new Date().toISOString(),
    expiresAt: expiresAt || null
  };
  
  config.api.tokens.push(newToken);
  saveConfig();
  
  res.json({
    success: true,
    token: newToken
  });
});

// 删除API令牌
app.delete('/api/tokens/:id', isAuthenticated, (req, res) => {
  const tokenId = req.params.id;
  const tokenIndex = config.api.tokens.findIndex(t => t.id === tokenId);
  
  if (tokenIndex === -1) {
    return res.status(404).json({ success: false, message: '找不到指定的令牌' });
  }
  
  config.api.tokens.splice(tokenIndex, 1);
  saveConfig();
  
  res.json({
    success: true,
    message: '令牌已成功删除'
  });
});

/* ---------------- 上传与图片接口（需登录） ---------------- */

// 上传接口：处理图片上传、存储位置及格式转换，同时自动重命名，并在文件名上增加三位数的上传顺序定位
app.post('/upload', isAuthenticated, upload.array('images'), async (req, res) => {
  try {
    // format: "original", "webp", "avif"，默认 original
    const formatOption = req.body.format || 'original';
    
    let resultImages = [];
    // 获取年月日文件夹路径及基本 URL
    const yearMonthPath = getYearMonthPath();
    const baseUrl = req.protocol + '://' + req.get('host');
    // 设置相同的上传时间，确保同一批次上传的文件时间一致
    const uploadTime = new Date();
    
    // 遍历每个上传文件，使用上传列表中的顺序生成三位数定位
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const orderIndex = (i + 1).toString().padStart(3, '0');
      const ext = path.extname(file.originalname).toLowerCase();
      let outputFormat = '';
      let outputFilename = '';
      let fileBuffer = file.buffer;
      
      // 自动重命名：使用 16 位随机十六进制字符串作为文件名，再加上三位数定位
      const uniqueId = crypto.randomBytes(8).toString('hex');
      
      // 获取原始格式
      const originalFormat = ext.replace('.', '').toLowerCase();
      
      // 根据上传选项进行图片格式转换与重命名
      if (formatOption === 'webp') {
        outputFormat = 'webp';
        outputFilename = uniqueId + orderIndex + '.webp';
        // 只有当原始格式不是webp时才进行转换
        if (originalFormat !== 'webp') {
          fileBuffer = await sharp(file.buffer).toFormat('webp').toBuffer();
        }
      } else if (formatOption === 'avif') {
        outputFormat = 'avif';
        outputFilename = uniqueId + orderIndex + '.avif';
        // 只有当原始格式不是avif时才进行转换
        if (originalFormat !== 'avif') {
          fileBuffer = await sharp(file.buffer).toFormat('avif').toBuffer();
        }
      } else {
        // 保持原始格式，但使用自动生成的文件名
        outputFormat = originalFormat;
        outputFilename = uniqueId + orderIndex + ext;
      }
      
      let imageUrl = '';
      let relativePath = path.join(yearMonthPath, outputFilename);

      // 存储到uploads目录
      const uploadDir = path.join(__dirname, 'uploads', yearMonthPath);
      ensureDirExistence(uploadDir);
      const destination = path.join(uploadDir, outputFilename);
      fs.writeFileSync(destination, fileBuffer);
      fs.utimesSync(destination, uploadTime, uploadTime);
      const urlPath = relativePath.replace(/\\/g, '/');
      imageUrl = `${baseUrl}/i/${urlPath}`;
      
      // 获取文件大小信息
      const stats = fs.statSync(destination);
      const fileSize = stats.size;
      
      resultImages.push({
        filename: outputFilename,
        path: relativePath.replace(/\\/g, '/'),
        uploadTime: uploadTime.toLocaleString(),
        fileSize: fileSize,
        storage: 'local',
        format: outputFormat,
        url: imageUrl,
        htmlCode: `<img src="${imageUrl}" alt="${outputFilename}" />`,
        markdownCode: `![](${imageUrl})`
      });
    }
    
    res.json({
      success: true,
      images: resultImages
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/* ---------------- API上传接口 ---------------- */

// API上传接口：处理图片上传，并将图片存储在api专用目录中
app.post('/api/upload', apiAuthenticated, upload.array('images'), async (req, res) => {
  try {
    // 优先使用请求中指定的格式，如果没有则使用默认格式设置
    const formatOption = req.query.format || config.api.defaultFormat || 'original';
    
    let resultImages = [];
    // 获取年月日文件夹路径及基本 URL
    const yearMonthPath = path.join('api', getYearMonthPath());
    const baseUrl = req.protocol + '://' + req.get('host');
    // 设置相同的上传时间，确保同一批次上传的文件时间一致
    const uploadTime = new Date();
    
    // 遍历每个上传文件，使用上传列表中的顺序生成三位数定位
    for (let i = 0; i < req.files.length; i++) {
      const file = req.files[i];
      const orderIndex = (i + 1).toString().padStart(3, '0');
      const ext = path.extname(file.originalname).toLowerCase();
      let outputFormat = '';
      let outputFilename = '';
      let fileBuffer = file.buffer;
      
      // 自动重命名：使用 16 位随机十六进制字符串作为文件名，再加上三位数定位
      const uniqueId = crypto.randomBytes(8).toString('hex');
      
      // 获取原始格式
      const originalFormat = ext.replace('.', '').toLowerCase();
      
      // 根据上传选项进行图片格式转换与重命名
      if (formatOption === 'webp') {
        outputFormat = 'webp';
        outputFilename = uniqueId + orderIndex + '.webp';
        // 只有当原始格式不是webp时才进行转换
        if (originalFormat !== 'webp') {
          fileBuffer = await sharp(file.buffer).toFormat('webp').toBuffer();
        }
      } else if (formatOption === 'avif') {
        outputFormat = 'avif';
        outputFilename = uniqueId + orderIndex + '.avif';
        // 只有当原始格式不是avif时才进行转换
        if (originalFormat !== 'avif') {
          fileBuffer = await sharp(file.buffer).toFormat('avif').toBuffer();
        }
      } else {
        // 保持原始格式，但使用自动生成的文件名
        outputFormat = originalFormat;
        outputFilename = uniqueId + orderIndex + ext;
      }
      
      let imageUrl = '';
      let relativePath = path.join(yearMonthPath, outputFilename);

      // 存储到api/uploads目录
      const uploadDir = path.join(__dirname, 'uploads', yearMonthPath);
      ensureDirExistence(uploadDir);
      const destination = path.join(uploadDir, outputFilename);
      fs.writeFileSync(destination, fileBuffer);
      fs.utimesSync(destination, uploadTime, uploadTime);
      const urlPath = relativePath.replace(/\\/g, '/');
      imageUrl = `${baseUrl}/i/${urlPath}`;
      
      // 获取文件大小信息
      const stats = fs.statSync(destination);
      const fileSize = stats.size;
      
      resultImages.push({
        filename: outputFilename,
        path: relativePath.replace(/\\/g, '/'),
        uploadTime: uploadTime.toLocaleString(),
        fileSize: fileSize,
        storage: 'local',
        format: outputFormat,
        url: imageUrl,
        htmlCode: `<img src="${imageUrl}" alt="${outputFilename}" />`,
        markdownCode: `![](${imageUrl})`
      });
    }
    
    // 根据PicGo等客户端的需求，返回不同格式的响应
    if (req.query.picgo === 'true') {
      // PicGo兼容格式
      return res.json({
        success: true,
        result: resultImages.map(img => img.url)
      });
    }
    
    res.json({
      success: true,
      images: resultImages
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 接口：获取所有图片（支持limit参数）
app.get('/images', isAuthenticated, async (req, res) => {
  const limit = parseInt(req.query.limit) || 30;
  let images = [];
  const baseUrl = req.protocol + '://' + req.get('host');
  
  // 获取uploads目录下的所有图片
  const uploadsDir = path.join(__dirname, 'uploads');
  if (fs.existsSync(uploadsDir)) {
    const uploadedFiles = getAllFiles(uploadsDir);
    uploadedFiles.forEach(filePath => {
      const stats = fs.statSync(filePath);
      const relativePath = path.relative(uploadsDir, filePath);
      const filename = path.basename(filePath);
      const imageUrl = `${baseUrl}/i/${relativePath.replace(/\\/g, '/')}`;
      
      images.push({
        filename: filename,
        path: relativePath.replace(/\\/g, '/'),
        uploadTime: stats.mtime.toLocaleString(),
        fileSize: stats.size,
        storage: 'local',
        format: path.extname(filename).substring(1),
        url: imageUrl,
        htmlCode: `<img src="${imageUrl}" alt="${filename}" />`,
        markdownCode: `![${filename}](${imageUrl})`
      });
    });
  }
  
  // 综合排序：首先按上传时间（降序），若上传时间相同则按文件名中后三位数字（从文件名尾部解析）升序排序
  images.sort((a, b) => {
    const dateA = new Date(a.uploadTime);
    const dateB = new Date(b.uploadTime);
    if (dateA.getTime() === dateB.getTime()) {
      const baseA = path.basename(a.filename, '.' + a.format);
      const baseB = path.basename(b.filename, '.' + b.format);
      const seqA = parseInt(baseA.slice(-3)) || 0;
      const seqB = parseInt(baseB.slice(-3)) || 0;
      return seqA - seqB;
    }
    return dateB - dateA;
  });
  
  if (limit > 0) {
    images = images.slice(0, limit);
  }
  
  res.json({ success: true, images: images });
});

// 分页获取图片
app.get('/images/paged', isAuthenticated, async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 50;
  let images = [];
  const baseUrl = req.protocol + '://' + req.get('host');
  
  // 获取uploads目录下的所有图片
  const uploadsDir = path.join(__dirname, 'uploads');
  if (fs.existsSync(uploadsDir)) {
    const uploadedFiles = getAllFiles(uploadsDir);
    uploadedFiles.forEach(filePath => {
      const stats = fs.statSync(filePath);
      const relativePath = path.relative(uploadsDir, filePath);
      const filename = path.basename(filePath);
      const imageUrl = `${baseUrl}/i/${relativePath.replace(/\\/g, '/')}`;
      
      images.push({
        filename: filename,
        path: relativePath.replace(/\\/g, '/'),
        uploadTime: stats.mtime.toLocaleString(),
        fileSize: stats.size,
        storage: 'local',
        format: path.extname(filename).substring(1),
        url: imageUrl,
        htmlCode: `<img src="${imageUrl}" alt="${filename}" />`,
        markdownCode: `![${filename}](${imageUrl})`
      });
    });
  }
  
  // 综合排序：首先按上传时间排序（降序），若同一时间则按文件名中后三位数字（定位）升序排序
  images.sort((a, b) => {
    const dateA = new Date(a.uploadTime);
    const dateB = new Date(b.uploadTime);
    if (dateA.getTime() === dateB.getTime()) {
      const baseA = path.basename(a.filename, '.' + a.format);
      const baseB = path.basename(b.filename, '.' + b.format);
      const seqA = parseInt(baseA.slice(-3)) || 0;
      const seqB = parseInt(baseB.slice(-3)) || 0;
      return seqA - seqB;
    }
    return dateB - dateA;
  });
  
  const totalImages = images.length;
  const totalPages = Math.ceil(totalImages / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = Math.min(startIndex + limit, totalImages);
  
  res.json({
    success: true,
    images: images.slice(startIndex, endIndex),
    pagination: {
      total: totalImages,
      page: page,
      limit: limit,
      totalPages: totalPages
    }
  });
});

// 图片库页面路由
app.get('/gallery', isAuthenticated, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'gallery.html'));
});

/* ---------------- 图片删除API ---------------- */

// 删除图片API（支持单张或多张删除）
app.post('/api/delete', isAuthenticated, async (req, res) => {
  try {
    let images = req.body.images;
    if (!Array.isArray(images)) {
      return res.status(400).json({ success: false, message: '无效的请求格式.' });
    }
    
    for (let image of images) {
      if (!image.storage || !image.path) continue;
      
      if (image.storage === 'local') {
        const filePath = path.join(__dirname, 'uploads', image.path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        } else {
          console.warn("文件不存在: ", filePath);
        }
      }
    }
    
    // 在删除图片后清理空文件夹
    cleanEmptyDirs(path.join(__dirname, 'uploads'));
    
    res.json({ success: true, message: '图片删除成功.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});