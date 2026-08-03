import Album from '../models/Album.js';
import Product from '../models/Product.js';

function formatAlbum(album) {
  return {
    id: album._id.toString(),
    name: album.name,
    itemCount: album.items?.length || 0,
    createdAt: album.createdAt,
    updatedAt: album.updatedAt,
  };
}

function formatProductSummary(product) {
  if (!product) {
    return null;
  }

  return {
    id: product._id.toString(),
    name: product.name,
    price: product.price,
    imageUrl: product.imageUrl,
    shopUrl: product.shopUrl,
  };
}

function formatAlbumDetail(album) {
  return {
    ...formatAlbum(album),
    items: (album.items || []).map((item) => ({
      id: item._id.toString(),
      product: formatProductSummary(item.product),
      notes: item.notes,
      savedFromUploadId: item.savedFromUploadId,
      detectedCategory: item.detectedCategory,
      detectedColor: item.detectedColor,
      savedAt: item.createdAt,
    })),
  };
}

export async function listAlbums(req, res) {
  try {
    const albums = await Album.find({ user: req.user._id })
      .select('name items createdAt updatedAt')
      .sort({ updatedAt: -1 });
    res.json({ albums: albums.map(formatAlbum) });
  } catch (error) {
    console.error('[OutFind] List albums error:', error);
    res.status(500).json({ error: 'Failed to load albums' });
  }
}

export async function createAlbum(req, res) {
  try {
    const name = req.body.name?.trim();
    if (!name) {
      return res.status(400).json({ error: 'Album name is required' });
    }

    const album = await Album.create({
      user: req.user._id,
      name,
      items: [],
    });

    res.status(201).json({ album: formatAlbum(album) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'You already have an album with this name' });
    }
    console.error('[OutFind] Create album error:', error);
    res.status(500).json({ error: 'Failed to create album' });
  }
}

export async function getAlbum(req, res) {
  try {
    const album = await Album.findOne({
      _id: req.params.albumId,
      user: req.user._id,
    }).populate('items.product', 'name price imageUrl shopUrl');

    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }

    res.json({ album: formatAlbumDetail(album) });
  } catch (error) {
    console.error('[OutFind] Get album error:', error);
    res.status(500).json({ error: 'Failed to load album' });
  }
}

export async function deleteAlbum(req, res) {
  try {
    const album = await Album.findOneAndDelete({
      _id: req.params.albumId,
      user: req.user._id,
    });

    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }

    res.json({ message: 'Album deleted' });
  } catch (error) {
    console.error('[OutFind] Delete album error:', error);
    res.status(500).json({ error: 'Failed to delete album' });
  }
}

export async function addProductToAlbum(req, res) {
  try {
    const { productId, notes, savedFromUploadId, detectedCategory, detectedColor } = req.body;

    if (!productId) {
      return res.status(400).json({ error: 'Product ID is required' });
    }

    const album = await Album.findOne({
      _id: req.params.albumId,
      user: req.user._id,
    });

    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }

    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const alreadySaved = album.items.some(
      (item) => item.product.toString() === product._id.toString()
    );

    if (alreadySaved) {
      return res.status(409).json({ error: 'Product is already in this album' });
    }

    album.items.unshift({
      product: product._id,
      notes: notes || '',
      savedFromUploadId: savedFromUploadId || '',
      detectedCategory: detectedCategory || '',
      detectedColor: detectedColor || '',
    });

    await album.save();

    const populated = await Album.findById(album._id).populate(
      'items.product',
      'name price imageUrl shopUrl',
    );
    res.status(201).json({ album: formatAlbumDetail(populated) });
  } catch (error) {
    console.error('[OutFind] Add to album error:', error);
    res.status(500).json({ error: 'Failed to save product to album' });
  }
}

export async function removeProductFromAlbum(req, res) {
  try {
    const album = await Album.findOne({
      _id: req.params.albumId,
      user: req.user._id,
    });

    if (!album) {
      return res.status(404).json({ error: 'Album not found' });
    }

    const initialLength = album.items.length;
    album.items = album.items.filter(
      (item) => item._id.toString() !== req.params.itemId
    );

    if (album.items.length === initialLength) {
      return res.status(404).json({ error: 'Saved item not found in album' });
    }

    await album.save();
    res.json({ message: 'Item removed from album' });
  } catch (error) {
    console.error('[OutFind] Remove from album error:', error);
    res.status(500).json({ error: 'Failed to remove item from album' });
  }
}
