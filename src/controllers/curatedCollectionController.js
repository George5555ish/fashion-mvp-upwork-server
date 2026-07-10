import CuratedCollection from '../models/CuratedCollection.js';
import CuratedLook from '../models/CuratedLook.js';

function formatLookSummary(look) {
  return {
    id: look._id.toString(),
    title: look.title,
    caption: look.caption,
    links: look.links || [],
    imageMimeType: look.imageMimeType,
    imageBase64: look.imageBase64,
    collectionId: look.collection?.toString() || null,
    createdAt: look.createdAt,
  };
}

function formatCollection(collection, looks = []) {
  return {
    id: collection._id.toString(),
    name: collection.name,
    published: collection.published,
    lookCount: looks.length,
    looks: looks.map(formatLookSummary),
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt,
  };
}

export async function listPublishedCollections(req, res) {
  try {
    const collections = await CuratedCollection.find({ published: true }).sort({ name: 1 });
    const collectionIds = collections.map((collection) => collection._id);

    const looks = await CuratedLook.find({
      published: true,
      collection: { $in: collectionIds },
    }).sort({ createdAt: -1 });

    const looksByCollection = new Map();
    for (const look of looks) {
      const key = look.collection.toString();
      if (!looksByCollection.has(key)) {
        looksByCollection.set(key, []);
      }
      looksByCollection.get(key).push(look);
    }

    const uncategorizedLooks = await CuratedLook.find({
      published: true,
      $or: [{ collection: null }, { collection: { $exists: false } }],
    }).sort({ createdAt: -1 });

    res.json({
      collections: collections
        .map((collection) => formatCollection(
          collection,
          looksByCollection.get(collection._id.toString()) || [],
        ))
        .filter((collection) => collection.looks.length > 0),
      uncategorizedLooks: uncategorizedLooks.map(formatLookSummary),
    });
  } catch (error) {
    console.error('[OutFind] List published collections error:', error);
    res.status(500).json({ error: 'Failed to load collections' });
  }
}

export async function getPublishedCollection(req, res) {
  try {
    const collection = await CuratedCollection.findOne({
      _id: req.params.collectionId,
      published: true,
    });

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    const looks = await CuratedLook.find({
      collection: collection._id,
      published: true,
    }).sort({ createdAt: -1 });

    res.json({ collection: formatCollection(collection, looks) });
  } catch (error) {
    console.error('[OutFind] Get published collection error:', error);
    res.status(500).json({ error: 'Failed to load collection' });
  }
}

export async function listAdminCollections(req, res) {
  try {
    const collections = await CuratedCollection.find({ createdBy: req.user._id }).sort({ name: 1 });
    const collectionIds = collections.map((collection) => collection._id);

    const looks = await CuratedLook.find({
      createdBy: req.user._id,
      collection: { $in: collectionIds },
    });

    const counts = new Map();
    for (const look of looks) {
      const key = look.collection.toString();
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    res.json({
      collections: collections.map((collection) => ({
        id: collection._id.toString(),
        name: collection.name,
        published: collection.published,
        lookCount: counts.get(collection._id.toString()) || 0,
        createdAt: collection.createdAt,
        updatedAt: collection.updatedAt,
      })),
    });
  } catch (error) {
    console.error('[OutFind] List admin collections error:', error);
    res.status(500).json({ error: 'Failed to load collections' });
  }
}

export async function createCollection(req, res) {
  try {
    const name = req.body.name?.trim();
    const published = req.body.published === true || req.body.published === 'true';

    if (!name) {
      return res.status(400).json({ error: 'Collection name is required' });
    }

    const collection = await CuratedCollection.create({
      name,
      published,
      createdBy: req.user._id,
    });

    res.status(201).json({
      collection: {
        id: collection._id.toString(),
        name: collection.name,
        published: collection.published,
        lookCount: 0,
        createdAt: collection.createdAt,
        updatedAt: collection.updatedAt,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'You already have a collection with this name' });
    }
    console.error('[OutFind] Create collection error:', error);
    res.status(500).json({ error: 'Failed to create collection' });
  }
}

export async function updateCollection(req, res) {
  try {
    const collection = await CuratedCollection.findOne({
      _id: req.params.collectionId,
      createdBy: req.user._id,
    });

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    if (req.body.name !== undefined) {
      collection.name = req.body.name.trim();
    }
    if (req.body.published !== undefined) {
      collection.published = req.body.published === true || req.body.published === 'true';
    }

    await collection.save();

    const lookCount = await CuratedLook.countDocuments({
      collection: collection._id,
      createdBy: req.user._id,
    });

    res.json({
      collection: {
        id: collection._id.toString(),
        name: collection.name,
        published: collection.published,
        lookCount,
        createdAt: collection.createdAt,
        updatedAt: collection.updatedAt,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: 'You already have a collection with this name' });
    }
    console.error('[OutFind] Update collection error:', error);
    res.status(500).json({ error: 'Failed to update collection' });
  }
}

export async function deleteCollection(req, res) {
  try {
    const collection = await CuratedCollection.findOneAndDelete({
      _id: req.params.collectionId,
      createdBy: req.user._id,
    });

    if (!collection) {
      return res.status(404).json({ error: 'Collection not found' });
    }

    await CuratedLook.updateMany(
      { collection: collection._id },
      { $set: { collection: null } },
    );

    res.json({ message: 'Collection deleted' });
  } catch (error) {
    console.error('[OutFind] Delete collection error:', error);
    res.status(500).json({ error: 'Failed to delete collection' });
  }
}
