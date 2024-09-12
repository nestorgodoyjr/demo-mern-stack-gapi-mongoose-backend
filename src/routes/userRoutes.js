import express from 'express';
import { registerUser, loginUser } from '../controllers/userController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', authenticateUser,loginUser);

export default router;
