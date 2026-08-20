import User from '../models/User.js';
import ClosetItem from '../models/ClosetItem.js';
import Album from '../models/Album.js';
import Outfit from '../models/Outfit.js';
import CuratedLook from '../models/CuratedLook.js';
import { sendBase64Image } from '../utils/imageResponse.js';

const CLOSET_ITEM_FIELDS = 'name category color user createdAt imageMimeType';
const SIGNUP_LOOKBACK_DAYS = 30;

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildSignupSeries(signupsByDay, days = SIGNUP_LOOKBACK_DAYS) {
  const counts = new Map(signupsByDay.map((entry) => [entry.date, entry.count]));
  const series = [];
  const today = startOfDay(new Date());

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(today);
    day.setDate(today.getDate() - offset);
    const key = day.toISOString().slice(0, 10);
    series.push({ date: key, count: counts.get(key) || 0 });
  }

  return series;
}

function formatUserSummary(user, stats) {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    closetItemCount: stats.closetCounts.get(user._id.toString()) || 0,
    albumCount: stats.albumCounts.get(user._id.toString()) || 0,
    savedProductCount: stats.savedProductCounts.get(user._id.toString()) || 0,
    outfitCount: stats.outfitCounts.get(user._id.toString()) || 0,
  };
}

async function loadCountMaps() {
  const [closetGroups, albumGroups, outfitGroups] = await Promise.all([
    ClosetItem.aggregate([
      { $group: { _id: '$user', count: { $sum: 1 } } },
    ]),
    Album.aggregate([
      {
        $group: {
          _id: '$user',
          count: { $sum: 1 },
          savedItems: { $sum: { $size: '$items' } },
        },
      },
    ]),
    Outfit.aggregate([
      { $group: { _id: '$user', count: { $sum: 1 } } },
    ]),
  ]);

  const closetCounts = new Map(
    closetGroups.map((entry) => [entry._id.toString(), entry.count]),
  );
  const albumCounts = new Map(
    albumGroups.map((entry) => [entry._id.toString(), entry.count]),
  );
  const savedProductCounts = new Map(
    albumGroups.map((entry) => [entry._id.toString(), entry.savedItems || 0]),
  );
  const outfitCounts = new Map(
    outfitGroups.map((entry) => [entry._id.toString(), entry.count]),
  );

  return { closetCounts, albumCounts, savedProductCounts, outfitCounts };
}

export async function getAdminDashboard(req, res) {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 7);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(now.getDate() - SIGNUP_LOOKBACK_DAYS);

    const [
      users,
      statsMaps,
      totalClosetItems,
      totalAlbums,
      totalOutfits,
      totalCuratedLooks,
      newUsersLast7Days,
      newUsersLast30Days,
      signupsByDayRaw,
      closetItems,
      albums,
    ] = await Promise.all([
      User.find().select('email name role createdAt').sort({ createdAt: -1 }),
      loadCountMaps(),
      ClosetItem.countDocuments(),
      Album.countDocuments(),
      Outfit.countDocuments(),
      CuratedLook.countDocuments(),
      User.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      User.countDocuments({ createdAt: { $gte: thirtyDaysAgo } }),
      User.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      ClosetItem.find()
        .select(CLOSET_ITEM_FIELDS)
        .populate('user', 'email name')
        .sort({ createdAt: -1 }),
      Album.find()
        .select('name user items createdAt updatedAt')
        .populate('user', 'email name')
        .sort({ updatedAt: -1 }),
    ]);

    const signupsByDay = buildSignupSeries(
      signupsByDayRaw.map((entry) => ({ date: entry._id, count: entry.count })),
    );

    const totalUsers = users.length;
    const signupDaysWithUsers = signupsByDay.filter((entry) => entry.count > 0).length;
    const signupFrequencyPerDay = signupDaysWithUsers > 0
      ? Math.round((newUsersLast30Days / signupDaysWithUsers) * 10) / 10
      : 0;

    res.json({
      summary: {
        totalUsers,
        newUsersLast7Days,
        newUsersLast30Days,
        signupFrequencyPerDay,
        totalClosetItems,
        totalAlbums,
        totalOutfits,
        totalCuratedLooks,
        totalSavedProducts: albums.reduce((sum, album) => sum + (album.items?.length || 0), 0),
        avgClosetItemsPerUser: totalUsers > 0
          ? Math.round((totalClosetItems / totalUsers) * 10) / 10
          : 0,
      },
      signupsByDay,
      users: users.map((user) => formatUserSummary(user, statsMaps)),
      closetItems: closetItems.map((item) => ({
        id: item._id.toString(),
        name: item.name,
        category: item.category,
        color: item.color,
        imageMimeType: item.imageMimeType,
        createdAt: item.createdAt,
        user: item.user?._id
          ? {
            id: item.user._id.toString(),
            email: item.user.email,
            name: item.user.name,
          }
          : null,
      })),
      albums: albums.map((album) => ({
        id: album._id.toString(),
        name: album.name,
        itemCount: album.items?.length || 0,
        createdAt: album.createdAt,
        updatedAt: album.updatedAt,
        user: album.user?._id
          ? {
            id: album.user._id.toString(),
            email: album.user.email,
            name: album.user.name,
          }
          : null,
      })),
    });
  } catch (error) {
    console.error('[OutFind] Admin dashboard error:', error);
    res.status(500).json({ error: 'Failed to load admin dashboard' });
  }
}

export async function getAdminUserDetail(req, res) {
  try {
    const user = await User.findById(req.params.userId).select('email name role createdAt updatedAt');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [closetItems, albums, outfits] = await Promise.all([
      ClosetItem.find({ user: user._id })
        .select('name category color imageMimeType createdAt')
        .sort({ createdAt: -1 }),
      Album.find({ user: user._id })
        .select('name items createdAt updatedAt')
        .populate('items.product', 'name price imageUrl shopUrl')
        .sort({ updatedAt: -1 }),
      Outfit.find({ user: user._id })
        .select('name items shareId isShared sharedAt createdAt updatedAt')
        .populate('items', 'name category color imageMimeType')
        .sort({ updatedAt: -1 }),
    ]);

    res.json({
      user: {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        closetItemCount: closetItems.length,
        albumCount: albums.length,
        savedProductCount: albums.reduce((sum, album) => sum + (album.items?.length || 0), 0),
        outfitCount: outfits.length,
      },
      closetItems: closetItems.map((item) => ({
        id: item._id.toString(),
        name: item.name,
        category: item.category,
        color: item.color,
        imageMimeType: item.imageMimeType,
        createdAt: item.createdAt,
      })),
      albums: albums.map((album) => ({
        id: album._id.toString(),
        name: album.name,
        itemCount: album.items?.length || 0,
        createdAt: album.createdAt,
        updatedAt: album.updatedAt,
        items: (album.items || []).map((item) => ({
          id: item._id.toString(),
          notes: item.notes || '',
          detectedCategory: item.detectedCategory || '',
          detectedColor: item.detectedColor || '',
          savedAt: item.createdAt,
          product: item.product
            ? {
              id: item.product._id.toString(),
              name: item.product.name,
              price: item.product.price,
              imageUrl: item.product.imageUrl,
              shopUrl: item.product.shopUrl,
            }
            : null,
        })),
      })),
      outfits: outfits.map((outfit) => ({
        id: outfit._id.toString(),
        name: outfit.name,
        isShared: Boolean(outfit.isShared),
        shareId: outfit.shareId || null,
        sharedAt: outfit.sharedAt || null,
        createdAt: outfit.createdAt,
        updatedAt: outfit.updatedAt,
        items: (outfit.items || []).map((item) => (
          item._id
            ? {
              id: item._id.toString(),
              name: item.name,
              category: item.category,
              color: item.color,
              imageMimeType: item.imageMimeType,
            }
            : null
        )).filter(Boolean),
      })),
    });
  } catch (error) {
    console.error('[OutFind] Admin user detail error:', error);
    res.status(500).json({ error: 'Failed to load user details' });
  }
}

export async function getAdminClosetItemImage(req, res) {
  try {
    const item = await ClosetItem.findById(req.params.itemId).select('imageBase64 imageMimeType');

    if (!item?.imageBase64) {
      return res.status(404).json({ error: 'Closet item not found' });
    }

    sendBase64Image(res, item.imageBase64, item.imageMimeType);
  } catch (error) {
    console.error('[OutFind] Admin closet item image error:', error);
    res.status(500).json({ error: 'Failed to load closet item image' });
  }
}
