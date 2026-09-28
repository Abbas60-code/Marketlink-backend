import Category from '../models/categoryModel.js';
import cloudinary from '../config/cloudinary.js';
import mongoose from 'mongoose';

// Helper function to generate URL-safe slug
const generateSlug = (text) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

// @desc    Create a new category
// @route   POST /api/categories
// @access  Private/Admin
export const createCategory = async (req, res) => {
  try {
    const { name, description, imageUrl, parentCategory, isActive, isFeatured, position } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, message: 'Category name is required' });
    }

    // Check if category name or slug already exists
    const slug = generateSlug(name);
    const existingCategory = await Category.findOne({
      $or: [{ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } }, { slug }],
    });

    if (existingCategory) {
      return res.status(400).json({ success: false, message: 'Category with this name already exists' });
    }

    let imageData = { url: '', public_id: '' };

    if (req.file) {
      imageData = {
        url: req.file.path,
        public_id: req.file.filename || req.file.public_id || '',
      };
    } else if (imageUrl) {
      imageData = {
        url: imageUrl,
        public_id: '',
      };
    }

    // Verify parent category if provided
    let parentId = null;
    if (parentCategory && parentCategory !== 'null' && parentCategory !== '') {
      if (!mongoose.Types.ObjectId.isValid(parentCategory)) {
        return res.status(400).json({ success: false, message: 'Invalid parent category ID' });
      }
      const parentExists = await Category.findById(parentCategory);
      if (!parentExists) {
        return res.status(404).json({ success: false, message: 'Parent category not found' });
      }
      parentId = parentCategory;
    }

    const category = await Category.create({
      name: name.trim(),
      slug,
      description: description || '',
      image: imageData,
      parentCategory: parentId,
      isActive: isActive !== undefined ? isActive === 'true' || isActive === true : true,
      isFeatured: isFeatured !== undefined ? isFeatured === 'true' || isFeatured === true : false,
      position: position !== undefined ? Number(position) : 0,
      createdBy: req.user ? req.user._id : undefined,
    });

    res.status(201).json({
      success: true,
      message: 'Category created successfully',
      data: category,
    });
  } catch (error) {
    console.error('Create Category Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all categories
// @route   GET /api/categories
// @access  Public
export const getAllCategories = async (req, res) => {
  try {
    const { isActive, isFeatured, parentCategory, search, rootOnly } = req.query;
    let query = {};

    if (isActive !== undefined) {
      query.isActive = isActive === 'true' || isActive === true;
    }

    if (isFeatured !== undefined) {
      query.isFeatured = isFeatured === 'true' || isFeatured === true;
    }

    if (rootOnly === 'true' || rootOnly === true) {
      query.parentCategory = null;
    } else if (parentCategory !== undefined) {
      query.parentCategory = parentCategory === 'null' ? null : parentCategory;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const categories = await Category.find(query)
      .populate('parentCategory', 'name slug')
      .populate('subcategories', 'name slug image isActive isFeatured position')
      .populate('createdBy', 'name email')
      .sort({ position: 1, name: 1 });

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    console.error('Get All Categories Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get active categories (for navigation/frontend store)
// @route   GET /api/categories/active
// @access  Public
export const getActiveCategories = async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true, parentCategory: null })
      .populate({
        path: 'subcategories',
        match: { isActive: true },
        select: 'name slug image isFeatured position',
      })
      .sort({ position: 1, name: 1 });

    res.status(200).json({
      success: true,
      count: categories.length,
      data: categories,
    });
  } catch (error) {
    console.error('Get Active Categories Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single category by ID or Slug
// @route   GET /api/categories/:idOrSlug
// @access  Public
export const getCategoryByIdOrSlug = async (req, res) => {
  try {
    const { idOrSlug } = req.params;
    let query = {};

    if (mongoose.Types.ObjectId.isValid(idOrSlug)) {
      query = { _id: idOrSlug };
    } else {
      query = { slug: idOrSlug.toLowerCase() };
    }

    const category = await Category.findOne(query)
      .populate('parentCategory', 'name slug')
      .populate('subcategories', 'name slug image isActive isFeatured position')
      .populate('createdBy', 'name email');

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    res.status(200).json({
      success: true,
      data: category,
    });
  } catch (error) {
    console.error('Get Category Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update category
// @route   PUT /api/categories/:id
// @access  Private/Admin
export const updateCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    const { name, description, imageUrl, parentCategory, isActive, isFeatured, position } = req.body;

    if (name && name.trim() !== category.name) {
      const newSlug = generateSlug(name);
      // Check if duplicate name/slug exists
      const duplicate = await Category.findOne({
        _id: { $ne: category._id },
        $or: [{ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } }, { slug: newSlug }],
      });

      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: 'Another category with this name already exists',
        });
      }

      category.name = name.trim();
      category.slug = newSlug;
    }

    if (description !== undefined) category.description = description;
    if (position !== undefined) category.position = Number(position);
    if (isActive !== undefined) category.isActive = isActive === 'true' || isActive === true;
    if (isFeatured !== undefined) category.isFeatured = isFeatured === 'true' || isFeatured === true;

    // Handle parentCategory update
    if (parentCategory !== undefined) {
      if (parentCategory === null || parentCategory === 'null' || parentCategory === '') {
        category.parentCategory = null;
      } else {
        if (parentCategory.toString() === category._id.toString()) {
          return res.status(400).json({
            success: false,
            message: 'A category cannot be its own parent',
          });
        }
        if (!mongoose.Types.ObjectId.isValid(parentCategory)) {
          return res.status(400).json({ success: false, message: 'Invalid parent category ID' });
        }
        const parentExists = await Category.findById(parentCategory);
        if (!parentExists) {
          return res.status(404).json({ success: false, message: 'Parent category not found' });
        }
        category.parentCategory = parentCategory;
      }
    }

    // Handle image update
    if (req.file) {
      if (category.image && category.image.public_id) {
        try {
          await cloudinary.uploader.destroy(category.image.public_id);
        } catch (cldErr) {
          console.error('Failed to remove previous Cloudinary image:', cldErr);
        }
      }
      category.image = {
        url: req.file.path,
        public_id: req.file.filename || req.file.public_id || '',
      };
    } else if (imageUrl) {
      category.image = {
        url: imageUrl,
        public_id: '',
      };
    }

    const updatedCategory = await category.save();

    res.status(200).json({
      success: true,
      message: 'Category updated successfully',
      data: updatedCategory,
    });
  } catch (error) {
    console.error('Update Category Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle category status (Active / Inactive)
// @route   PATCH /api/categories/:id/status
// @access  Private/Admin
export const toggleCategoryStatus = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    category.isActive = !category.isActive;
    await category.save();

    res.status(200).json({
      success: true,
      message: `Category marked as ${category.isActive ? 'Active' : 'Inactive'}`,
      data: category,
    });
  } catch (error) {
    console.error('Toggle Category Status Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle category featured flag
// @route   PATCH /api/categories/:id/featured
// @access  Private/Admin
export const toggleFeaturedStatus = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    category.isFeatured = !category.isFeatured;
    await category.save();

    res.status(200).json({
      success: true,
      message: `Category ${category.isFeatured ? 'marked as Featured' : 'removed from Featured'}`,
      data: category,
    });
  } catch (error) {
    console.error('Toggle Category Featured Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete category
// @route   DELETE /api/categories/:id
// @access  Private/Admin
export const deleteCategory = async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }

    // Delete image from Cloudinary if exists
    if (category.image && category.image.public_id) {
      try {
        await cloudinary.uploader.destroy(category.image.public_id);
      } catch (cldErr) {
        console.error('Failed to remove Cloudinary image on category delete:', cldErr);
      }
    }

    // Unlink subcategories (set parentCategory to null)
    await Category.updateMany(
      { parentCategory: category._id },
      { $set: { parentCategory: null } }
    );

    await Category.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Category deleted successfully',
      deletedId: req.params.id,
    });
  } catch (error) {
    console.error('Delete Category Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
