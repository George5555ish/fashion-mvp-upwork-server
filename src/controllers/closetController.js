import ClosetItem from '../models/ClosetItem.js';
import Outfit from '../models/Outfit.js';
import { v4 as uuidv4 } from 'uuid';
const VALID_CATEGORIES = [
  'top', 'shirt', 'jacket', 'coat', 'pants', 'jeans', 'dress',
  'skirt', 'shoes', 'sneakers', 'boots', 'accessories', 'bag',
];

function formatClosetItem(item) {
  return {
    id: item._id.toString(),
    name: item.name,
    category: item.category,
    color: item.color,
    imageMimeType: item.imageMimeType,
    imageBase64: item.imageBase64,
    createdAt: item.createdAt,
  };
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
    const items = await ClosetItem.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.json({ items: items.map(formatClosetItem) });
  } catch (error) {
    console.error('[OutFind] List closet items error:', error);
    res.status(500).json({ error: 'Failed to load closet items' });
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

    const item = await ClosetItem.create({
      user: req.user._id,
      name,
      category,
      color,
      imageBase64: req.file.buffer.toString('base64'),
      imageMimeType: req.file.mimetype,
    });

    res.status(201).json({ item: formatClosetItem(item) });
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

export async function listOutfits(req, res) {
  try {
    const outfits = await Outfit.find({ user: req.user._id })
      .populate('items')
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

    const populated = await Outfit.findById(outfit._id).populate('items');
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
    }).populate('items');

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
      .populate('items')
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

export { VALID_CATEGORIES };
