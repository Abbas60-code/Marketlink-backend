import Banner from '../models/bannerModel.js';
import cloudinary from '../config/cloudinary.js';

// @desc    Create a new banner
// @route   POST /api/banners
// @access  Private/Admin
export const createBanner = async (req, res) => {
  try {
    const {
      title,
      subtitle,
      description,
      imageUrl,
      link,
      category,
      position,
      isActive,
      startDate,
      endDate,
    } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Banner title is required' });
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
    } else {
      return res.status(400).json({ message: 'Banner image file or imageUrl is required' });
    }

    const banner = await Banner.create({
      title,
      subtitle: subtitle || '',
      description: description || '',
      image: imageData,
      link: link || '',
      category: category || 'main',
      position: position !== undefined ? Number(position) : 0,
      isActive: isActive !== undefined ? isActive === 'true' || isActive === true : true,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      createdBy: req.user ? req.user._id : undefined,
    });

    res.status(201).json({
      success: true,
      message: 'Banner created successfully',
      data: banner,
    });
  } catch (error) {
    console.error('Create Banner Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all banners (with search, category filter, active filter & sorting)
// @route   GET /api/banners
// @access  Public
export const getAllBanners = async (req, res) => {
  try {
    const { category, isActive, search } = req.query;
    let query = {};

    if (category) {
      query.category = category;
    }

    if (isActive !== undefined) {
      query.isActive = isActive === 'true' || isActive === true;
    }

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { subtitle: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const banners = await Banner.find(query)
      .populate('createdBy', 'name email')
      .sort({ position: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: banners.length,
      data: banners,
    });
  } catch (error) {
    console.error('Get All Banners Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get active banners for frontend display
// @route   GET /api/banners/active
// @access  Public
export const getActiveBanners = async (req, res) => {
  try {
    const { category } = req.query;
    const now = new Date();

    const query = {
      isActive: true,
      $and: [
        { $or: [{ startDate: { $exists: false } }, { startDate: null }, { startDate: { $lte: now } }] },
        { $or: [{ endDate: { $exists: false } }, { endDate: null }, { endDate: { $gte: now } }] },
      ],
    };

    if (category) {
      query.category = category;
    }

    const banners = await Banner.find(query).sort({ position: 1, createdAt: -1 });

    res.status(200).json({
      success: true,
      count: banners.length,
      data: banners,
    });
  } catch (error) {
    console.error('Get Active Banners Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get single banner by ID
// @route   GET /api/banners/:id
// @access  Public
export const getBannerById = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id).populate('createdBy', 'name email');

    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    res.status(200).json({
      success: true,
      data: banner,
    });
  } catch (error) {
    console.error('Get Banner By ID Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update banner
// @route   PUT /api/banners/:id
// @access  Private/Admin
export const updateBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    const {
      title,
      subtitle,
      description,
      imageUrl,
      link,
      category,
      position,
      isActive,
      startDate,
      endDate,
    } = req.body;

    if (title !== undefined) banner.title = title;
    if (subtitle !== undefined) banner.subtitle = subtitle;
    if (description !== undefined) banner.description = description;
    if (link !== undefined) banner.link = link;
    if (category !== undefined) banner.category = category;
    if (position !== undefined) banner.position = Number(position);
    if (isActive !== undefined) banner.isActive = isActive === 'true' || isActive === true;
    if (startDate !== undefined) banner.startDate = startDate ? new Date(startDate) : undefined;
    if (endDate !== undefined) banner.endDate = endDate ? new Date(endDate) : undefined;

    // If new image file is uploaded
    if (req.file) {
      // Delete old image from Cloudinary if it exists
      if (banner.image && banner.image.public_id) {
        try {
          await cloudinary.uploader.destroy(banner.image.public_id);
        } catch (cldErr) {
          console.error('Failed to remove previous Cloudinary image:', cldErr);
        }
      }

      banner.image = {
        url: req.file.path,
        public_id: req.file.filename || req.file.public_id || '',
      };
    } else if (imageUrl) {
      banner.image = {
        url: imageUrl,
        public_id: '',
      };
    }

    const updatedBanner = await banner.save();

    res.status(200).json({
      success: true,
      message: 'Banner updated successfully',
      data: updatedBanner,
    });
  } catch (error) {
    console.error('Update Banner Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Toggle banner status (Active / Inactive)
// @route   PATCH /api/banners/:id/status
// @access  Private/Admin
export const toggleBannerStatus = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    banner.isActive = !banner.isActive;
    await banner.save();

    res.status(200).json({
      success: true,
      message: `Banner marked as ${banner.isActive ? 'Active' : 'Inactive'}`,
      data: banner,
    });
  } catch (error) {
    console.error('Toggle Banner Status Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete banner
// @route   DELETE /api/banners/:id
// @access  Private/Admin
export const deleteBanner = async (req, res) => {
  try {
    const banner = await Banner.findById(req.params.id);

    if (!banner) {
      return res.status(404).json({ success: false, message: 'Banner not found' });
    }

    // Delete image from Cloudinary if public_id exists
    if (banner.image && banner.image.public_id) {
      try {
        await cloudinary.uploader.destroy(banner.image.public_id);
      } catch (cldErr) {
        console.error('Failed to delete banner image from Cloudinary:', cldErr);
      }
    }

    await Banner.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Banner deleted successfully',
      deletedId: req.params.id,
    });
  } catch (error) {
    console.error('Delete Banner Error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};
