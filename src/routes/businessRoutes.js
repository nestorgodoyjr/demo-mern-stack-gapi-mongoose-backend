import express from 'express';
import { addBusiness } from '../controllers/businessController.js';
import { authenticateUser } from '../middleware/authMiddleware.js';

const router = express.Router();

router.post('/', authenticateUser, addBusiness);

export default router;
