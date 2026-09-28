import express from 'express';
import { getMyFavorites, addFavorite, removeFavorite } from '../controllers/favoriteController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, getMyFavorites);
router.post('/', protect, addFavorite);
router.delete('/:id', protect, removeFavorite);

export default router;
