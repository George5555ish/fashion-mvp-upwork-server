import CuratedLook from '../models/CuratedLook.js';
import CuratedCollection from '../models/CuratedCollection.js';
import { sendBase64Image } from '../utils/imageResponse.js';
import { compressUploadedFile } from '../utils/imageCompression.js';

function formatLook(look, includeImage = true) {
  const formatted = {
    id: look._id.toString(),
    title: look.title,
    caption: look.caption,
    links: look.links || [],
    published: look.published,
    collectionId: look.collection?._id?.toString() || look.collection?.toString() || null,
    collectionName: look.collection?.name || null,
    createdAt: look.createdAt,
    updatedAt: look.updatedAt,
  };

  if (includeImage) {
    formatted.imageMimeType = look.imageMimeType;
    formatted.imageBase64 = look.imageBase64;
  }

  return formatted;
}

async function resolveCollectionId(collectionId, userId) {
  if (!collectionId || collectionId === 'none' || collectionId === 'null') {
    return null;
  }

  const collection = await CuratedCollection.findOne({
    _id: collectionId,
    createdBy: userId,
  });

  if (!collection) {
    throw new Error('Collection not found');
  }

  return collection._id;
}

export async function listPublishedLooks(req, res) {
  try {
    const looks = await CuratedLook.find({ published: true })
      .select('title caption links imageMimeType collection createdAt')
      .populate('collection', 'name published')
      .sort({ createdAt: -1 });

    res.json({
      looks: looks
        .filter((look) => !look.collection || look.collection.published)
        .map((look) => ({
          id: look._id.toString(),
          title: look.title,
          caption: look.caption,
          links: look.links || [],
          imageMimeType: look.imageMimeType,
          collectionId: look.collection?._id?.toString() || null,
          collectionName: look.collection?.name || null,
          createdAt: look.createdAt,
        })),
    });
  } catch (error) {
    console.error('[OutFind] List looks error:', error);
    res.status(500).json({ error: 'Failed to load looks' });
  }
}

export async function getPublishedLookImage(req, res) {
  try {
    const look = await CuratedLook.findOne({
      _id: req.params.lookId,
      published: true,
    })
      .select('imageBase64 imageMimeType collection')
      .populate('collection', 'published');

    if (!look?.imageBase64) {
      return res.status(404).json({ error: 'Look not found' });
    }

    if (look.collection && !look.collection.published) {
      return res.status(404).json({ error: 'Look not found' });
    }

    sendBase64Image(res, look.imageBase64, look.imageMimeType);
  } catch (error) {
    console.error('[OutFind] Get look image error:', error);
    res.status(500).json({ error: 'Failed to load look image' });
  }
}

export async function getPublishedLook(req, res) {
  try {
    const look = await CuratedLook.findOne({
      _id: req.params.lookId,
      published: true,
    })
      .select('title caption links imageMimeType collection createdAt updatedAt')
      .populate('collection', 'name published');

    if (!look) {
      return res.status(404).json({ error: 'Look not found' });
    }

    if (look.collection && !look.collection.published) {
      return res.status(404).json({ error: 'Look not found' });
    }

    res.json({ look: formatLook(look, false) });
  } catch (error) {
    console.error('[OutFind] Get look error:', error);
    res.status(500).json({ error: 'Failed to load look' });
  }
}

export async function listAdminLooks(req, res) {
  try {
    const looks = await CuratedLook.find({ createdBy: req.user._id })
      .select('title caption links imageMimeType published collection createdAt updatedAt')
      .populate('collection', 'name published')
      .sort({ createdAt: -1 });

    res.json({ looks: looks.map((look) => formatLook(look, false)) });
  } catch (error) {
    console.error('[OutFind] List admin looks error:', error);
    res.status(500).json({ error: 'Failed to load admin looks' });
  }
}

export async function getAdminLookImage(req, res) {
  try {
    const look = await CuratedLook.findOne({
      _id: req.params.lookId,
      createdBy: req.user._id,
    }).select('imageBase64 imageMimeType');

    if (!look?.imageBase64) {
      return res.status(404).json({ error: 'Look not found' });
    }

    sendBase64Image(res, look.imageBase64, look.imageMimeType);
  } catch (error) {
    console.error('[OutFind] Get admin look image error:', error);
    res.status(500).json({ error: 'Failed to load look image' });
  }
}

export async function createLook(req, res) {
  try {
    const title = req.body.title?.trim();
    const caption = req.body.caption?.trim() || '';
    const published = req.body.published === true || req.body.published === 'true';
    const links = parseLinks(req.body.links);
    const collection = await resolveCollectionId(req.body.collectionId, req.user._id);

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Outfit image is required' });
    }

    const compressed = await compressUploadedFile(req.file);

    const look = await CuratedLook.create({
      title,
      caption,
      links,
      published,
      collection,
      imageBase64: compressed.base64,
      imageMimeType: compressed.mimeType,
      createdBy: req.user._id,
    });

    await look.populate('collection', 'name published');
    res.status(201).json({ look: formatLook(look) });
  } catch (error) {
    if (error.message === 'Collection not found') {
      return res.status(400).json({ error: error.message });
    }
    console.error('[OutFind] Create look error:', error);
    res.status(500).json({ error: 'Failed to create look' });
  }
}

export async function updateLook(req, res) {
  try {
    const look = await CuratedLook.findOne({
      _id: req.params.lookId,
      createdBy: req.user._id,
    });

    if (!look) {
      return res.status(404).json({ error: 'Look not found' });
    }

    if (req.body.title !== undefined) {
      look.title = req.body.title.trim();
    }
    if (req.body.caption !== undefined) {
      look.caption = req.body.caption.trim();
    }
    if (req.body.published !== undefined) {
      look.published = req.body.published === true || req.body.published === 'true';
    }
    if (req.body.links !== undefined) {
      look.links = parseLinks(req.body.links);
    }
    if (req.body.collectionId !== undefined) {
      look.collection = await resolveCollectionId(req.body.collectionId, req.user._id);
    }
    if (req.file) {
      const compressed = await compressUploadedFile(req.file);
      look.imageBase64 = compressed.base64;
      look.imageMimeType = compressed.mimeType;
    }

    await look.save();
    await look.populate('collection', 'name published');
    res.json({ look: formatLook(look) });
  } catch (error) {
    if (error.message === 'Collection not found') {
      return res.status(400).json({ error: error.message });
    }
    console.error('[OutFind] Update look error:', error);
    res.status(500).json({ error: 'Failed to update look' });
  }
}

export async function deleteLook(req, res) {
  try {
    const look = await CuratedLook.findOneAndDelete({
      _id: req.params.lookId,
      createdBy: req.user._id,
    });

    if (!look) {
      return res.status(404).json({ error: 'Look not found' });
    }

    res.json({ message: 'Look deleted' });
  } catch (error) {
    console.error('[OutFind] Delete look error:', error);
    res.status(500).json({ error: 'Failed to delete look' });
  }
}

function parseLinks(rawLinks) {
  if (!rawLinks) {
    return [];
  }

  let parsed = rawLinks;
  if (typeof rawLinks === 'string') {
    parsed = JSON.parse(rawLinks);
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  return parsed
    .map((link) => ({
      label: link.label?.trim(),
      url: link.url?.trim(),
    }))
    .filter((link) => link.label && link.url);
}
