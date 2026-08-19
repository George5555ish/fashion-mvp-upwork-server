import ClosetItem from '../models/ClosetItem.js';
import Outfit from '../models/Outfit.js';
import { v4 as uuidv4 } from 'uuid';
import { sendBase64Image } from '../utils/imageResponse.js';
import { compressUploadedFile } from '../utils/imageCompression.js';
import { MAX_CLOSET_ITEMS_PER_USER } from '../config/limits.js';

const VALID_CATEGORIES = [
  'top', 'shirt', 'jacket', 'coat', 'pants', 'jeans', 'dress',
  'skirt', 'shoes', 'sneakers', 'boots', 'accessories', 'bag',
];

const CLOSET_ITEM_LIST_FIELDS = 'name category color imageMimeType createdAt';

function formatClosetItem(item, { includeImage = false } = {}) {
  const formatted = {
    id: item._id.toString(),
    name: item.name,
    category: item.category,
    color: item.color,
    imageMimeType: item.imageMimeType,
    createdAt: item.createdAt,
  };

  if (includeImage && item.imageBase64) {
    formatted.imageBase64 = item.imageBase64;
  }

  return formatted;
}

function formatOutfit(outfit) {
  return {
    id: outfit._id.toString(),
    name: outfit.name,
    items: (outfit.items || []).map((item) => (
      item._id ? formatClosetItem(item) : item
    )),
    shareId: outfit.shareId || null,
    isShared: Boolean(outfit.isShared),
    sharedAt: outfit.sharedAt || null,
    createdAt: outfit.createdAt,
    updatedAt: outfit.updatedAt,
  };
}

function formatSharedOutfit(outfit) {
  return {
    name: outfit.name,
    creatorName: outfit.user?.name || 'A friend',
    items: (outfit.items || []).map((item) => formatClosetItem(item)),
    sharedAt: outfit.sharedAt || outfit.updatedAt,
  };
}
export async function listClosetItems(req, res) {
  try {
    const items = await ClosetItem.find({ user: req.user._id })
      .select(CLOSET_ITEM_LIST_FIELDS)
      .sort({ createdAt: -1 });
    res.json({
      items: items.map((item) => formatClosetItem(item)),
      limits: {
        current: items.length,
        max: MAX_CLOSET_ITEMS_PER_USER,
      },
    });
  } catch (error) {
    console.error('[OutFind] List closet items error:', error);
    res.status(500).json({ error: 'Failed to load closet items' });
  }
}

export async function getClosetItemImage(req, res) {
  try {
    const item = await ClosetItem.findOne({
      _id: req.params.itemId,
      user: req.user._id,
    }).select('imageBase64 imageMimeType');

    if (!item?.imageBase64) {
      return res.status(404).json({ error: 'Closet item not found' });
    }

    sendBase64Image(res, item.imageBase64, item.imageMimeType);
  } catch (error) {
    console.error('[OutFind] Get closet item image error:', error);
    res.status(500).json({ error: 'Failed to load closet item image' });
  }
}

export async function createClosetItem(req, res) {
  try {
    const name = req.body.name?.trim();
    const category = req.body.category?.trim().toLowerCase();
    const color = req.body.color?.trim() || '';

    if (!name || !category) {
      return res.status(400).json({ error: 'Name and category are required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Item image is required' });
    }

    const itemCount = await ClosetItem.countDocuments({ user: req.user._id });
    if (itemCount >= MAX_CLOSET_ITEMS_PER_USER) {
      return res.status(403).json({
        error: `Closet limit reached (${MAX_CLOSET_ITEMS_PER_USER} items). Remove an item to add more.`,
      });
    }

    const compressed = await compressUploadedFile(req.file);

    const item = await ClosetItem.create({
      user: req.user._id,
      name,
      category,
      color,
      imageBase64: compressed.base64,
      imageMimeType: compressed.mimeType,
    });

    res.status(201).json({ item: formatClosetItem(item, { includeImage: true }) });
  } catch (error) {
    console.error('[OutFind] Create closet item error:', error);
    res.status(500).json({ error: 'Failed to add closet item' });
  }
}

export async function deleteClosetItem(req, res) {
  try {
    const item = await ClosetItem.findOneAndDelete({
      _id: req.params.itemId,
      user: req.user._id,
    });

    if (!item) {
      return res.status(404).json({ error: 'Closet item not found' });
    }

    await Outfit.updateMany(
      { user: req.user._id },
      { $pull: { items: item._id } }
    );

    res.json({ message: 'Closet item deleted' });
  } catch (error) {
    console.error('[OutFind] Delete closet item error:', error);
    res.status(500).json({ error: 'Failed to delete closet item' });
  }
}

export async function updateClosetItem(req, res) {
  try {
    const item = await ClosetItem.findOne({
      _id: req.params.itemId,
      user: req.user._id,
    });

    if (!item) {
      return res.status(404).json({ error: 'Closet item not found' });
    }

    if (req.body.name !== undefined) {
      item.name = req.body.name.trim();
    }
    if (req.body.category !== undefined) {
      item.category = req.body.category.trim().toLowerCase();
    }
    if (req.body.color !== undefined) {
      item.color = req.body.color.trim();
    }
    if (req.file) {
      const compressed = await compressUploadedFile(req.file);
      item.imageBase64 = compressed.base64;
      item.imageMimeType = compressed.mimeType;
    }

    if (!item.name || !item.category) {
      return res.status(400).json({ error: 'Name and category are required' });
    }

    await item.save();
    res.json({ item: formatClosetItem(item, { includeImage: true }) });
  } catch (error) {
    console.error('[OutFind] Update closet item error:', error);
    res.status(500).json({ error: 'Failed to update closet item' });
  }
}

export async function listOutfits(req, res) {
  try {
    const outfits = await Outfit.find({ user: req.user._id })
      .populate('items', CLOSET_ITEM_LIST_FIELDS)
      .sort({ updatedAt: -1 });

    res.json({ outfits: outfits.map(formatOutfit) });
  } catch (error) {
    console.error('[OutFind] List outfits error:', error);
    res.status(500).json({ error: 'Failed to load outfits' });
  }
}

export async function createOutfit(req, res) {
  try {
    const name = req.body.name?.trim();
    const itemIds = Array.isArray(req.body.itemIds) ? req.body.itemIds : [];

    if (!name) {
      return res.status(400).json({ error: 'Outfit name is required' });
    }

    if (itemIds.length === 0) {
      return res.status(400).json({ error: 'Select at least one closet item' });
    }

    const ownedItems = await ClosetItem.find({
      _id: { $in: itemIds },
      user: req.user._id,
    });

    if (ownedItems.length !== itemIds.length) {
      return res.status(400).json({ error: 'One or more closet items are invalid' });
    }

    const outfit = await Outfit.create({
      user: req.user._id,
      name,
      items: itemIds,
    });

    const populated = await Outfit.findById(outfit._id).populate('items', CLOSET_ITEM_LIST_FIELDS);
    res.status(201).json({ outfit: formatOutfit(populated) });
  } catch (error) {
    console.error('[OutFind] Create outfit error:', error);
    res.status(500).json({ error: 'Failed to create outfit' });
  }
}

export async function deleteOutfit(req, res) {
  try {
    const outfit = await Outfit.findOneAndDelete({
      _id: req.params.outfitId,
      user: req.user._id,
    });

    if (!outfit) {
      return res.status(404).json({ error: 'Outfit not found' });
    }

    res.json({ message: 'Outfit deleted' });
  } catch (error) {
    console.error('[OutFind] Delete outfit error:', error);
    res.status(500).json({ error: 'Failed to delete outfit' });
  }
}

export async function shareOutfit(req, res) {
  try {
    const outfit = await Outfit.findOne({
      _id: req.params.outfitId,
      user: req.user._id,
    }).populate('items', CLOSET_ITEM_LIST_FIELDS);

    if (!outfit) {
      return res.status(404).json({ error: 'Outfit not found' });
    }

    if (!outfit.shareId) {
      outfit.shareId = uuidv4();
    }

    outfit.isShared = true;
    outfit.sharedAt = new Date();
    await outfit.save();

    res.json({
      outfit: formatOutfit(outfit),
      shareId: outfit.shareId,
    });
  } catch (error) {
    console.error('[OutFind] Share outfit error:', error);
    res.status(500).json({ error: 'Failed to share outfit' });
  }
}

export async function getSharedOutfit(req, res) {
  try {
    const outfit = await Outfit.findOne({
      shareId: req.params.shareId,
      isShared: true,
    })
      .populate('items', CLOSET_ITEM_LIST_FIELDS)
      .populate('user', 'name');

    if (!outfit) {
      return res.status(404).json({ error: 'Shared outfit not found or link has expired' });
    }

    res.json({ outfit: formatSharedOutfit(outfit) });
  } catch (error) {
    console.error('[OutFind] Get shared outfit error:', error);
    res.status(500).json({ error: 'Failed to load shared outfit' });
  }
}

export async function getSharedOutfitItemImage(req, res) {
  try {
    const outfit = await Outfit.findOne({
      shareId: req.params.shareId,
      isShared: true,
    }).select('items');

    if (!outfit) {
      return res.status(404).json({ error: 'Shared outfit not found or link has expired' });
    }

    const itemBelongsToShare = outfit.items.some(
      (itemId) => itemId.toString() === req.params.itemId,
    );

    if (!itemBelongsToShare) {
      return res.status(404).json({ error: 'Closet item not found' });
    }

    const item = await ClosetItem.findById(req.params.itemId).select('imageBase64 imageMimeType');

    if (!item?.imageBase64) {
      return res.status(404).json({ error: 'Closet item not found' });
    }

    sendBase64Image(res, item.imageBase64, item.imageMimeType);
  } catch (error) {
    console.error('[OutFind] Get shared outfit item image error:', error);
    res.status(500).json({ error: 'Failed to load closet item image' });
  }
}

export { VALID_CATEGORIES };
