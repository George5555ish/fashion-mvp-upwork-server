import CuratedLook from '../models/CuratedLook.js';

function formatLook(look, includeImage = true) {
  const formatted = {
    id: look._id.toString(),
    title: look.title,
    caption: look.caption,
    links: look.links || [],
    published: look.published,
    createdAt: look.createdAt,
    updatedAt: look.updatedAt,
  };

  if (includeImage) {
    formatted.imageMimeType = look.imageMimeType;
    formatted.imageBase64 = look.imageBase64;
  }

  return formatted;
}

export async function listPublishedLooks(req, res) {
  try {
    const looks = await CuratedLook.find({ published: true })
      .sort({ createdAt: -1 });

    res.json({
      looks: looks.map((look) => ({
        id: look._id.toString(),
        title: look.title,
        caption: look.caption,
        links: look.links || [],
        imageMimeType: look.imageMimeType,
        imageBase64: look.imageBase64,
        createdAt: look.createdAt,
      })),
    });
  } catch (error) {
    console.error('[OutFind] List looks error:', error);
    res.status(500).json({ error: 'Failed to load looks' });
  }
}

export async function getPublishedLook(req, res) {
  try {
    const look = await CuratedLook.findOne({
      _id: req.params.lookId,
      published: true,
    });

    if (!look) {
      return res.status(404).json({ error: 'Look not found' });
    }

    res.json({ look: formatLook(look) });
  } catch (error) {
    console.error('[OutFind] Get look error:', error);
    res.status(500).json({ error: 'Failed to load look' });
  }
}

export async function listAdminLooks(req, res) {
  try {
    const looks = await CuratedLook.find({ createdBy: req.user._id })
      .sort({ createdAt: -1 });

    res.json({ looks: looks.map((look) => formatLook(look)) });
  } catch (error) {
    console.error('[OutFind] List admin looks error:', error);
    res.status(500).json({ error: 'Failed to load admin looks' });
  }
}

export async function createLook(req, res) {
  try {
    const title = req.body.title?.trim();
    const caption = req.body.caption?.trim() || '';
    const published = req.body.published === true || req.body.published === 'true';
    const links = parseLinks(req.body.links);

    if (!title) {
      return res.status(400).json({ error: 'Title is required' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'Outfit image is required' });
    }

    const look = await CuratedLook.create({
      title,
      caption,
      links,
      published,
      imageBase64: req.file.buffer.toString('base64'),
      imageMimeType: req.file.mimetype,
      createdBy: req.user._id,
    });

    res.status(201).json({ look: formatLook(look) });
  } catch (error) {
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
    if (req.file) {
      look.imageBase64 = req.file.buffer.toString('base64');
      look.imageMimeType = req.file.mimetype;
    }

    await look.save();
    res.json({ look: formatLook(look) });
  } catch (error) {
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
