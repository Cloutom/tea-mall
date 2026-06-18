import multer from 'multer';
// @ts-ignore
import multerS3 from 'multer-s3';
import { s3Client, S3_BUCKET } from '../config/aws';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// S3 업로드 설정
const s3Storage = multerS3({
  s3: s3Client,
  bucket: S3_BUCKET,
  contentType: multerS3.AUTO_CONTENT_TYPE,
  metadata: (req: any, file: any, cb: any) => {
    cb(null, { fieldName: file.fieldname });
  },
  key: (req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const folder = req.path.includes('product') ? 'products' : 'stores';
    cb(null, `${folder}/${uuidv4()}${ext}`);
  },
});

// 로컬 임시 저장 (개발용)
const localStorage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const fileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('JPG, PNG, WEBP, GIF 형식만 업로드 가능합니다.'));
  }
};

const hasS3 = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_ACCESS_KEY_ID !== 'your-aws-access-key';
const storage = hasS3 ? s3Storage : localStorage;

export const uploadSingle = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
}).single('image');

export const uploadMultiple = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
}).array('images', 10);

export const uploadFields = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
}).fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'images', maxCount: 9 },
]);

export const uploadStoreFields = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
}).fields([
  { name: 'logo', maxCount: 1 },
  { name: 'banner', maxCount: 1 },
]);

export const uploadReviewImages = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
}).array('reviewImages', 5);
