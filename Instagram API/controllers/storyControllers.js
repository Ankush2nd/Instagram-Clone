const Story = require('../models/storyModel');
const factory = require('./handleFactory');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const User = require('../models/usersModel');
const { s3 } = require('./s3');
const { uploadImageInStory } = require('./s3bucket');

// Middleware to set user for the request body
exports.setUser = catchAsync(async (req, res, next) => {
	const userProfile = await User.findById(req.user.id);
	if (!userProfile) {
		return next(new AppError(`Please create an account`, 404));
	}
	if (!req.body.user) req.body.user = userProfile;
	next();
});

// Middleware to check if the user is the owner of the story
exports.checkOwner = catchAsync(async (req, res, next) => {
	const story = await Story.findById(req.params.id);
	if (story.user._id.toString() !== req.user.id.toString()) {
		return next(new AppError(`You are not owner of this story`, 404));
	}
	next();
});

// Controller to get stories created by the logged-in user
exports.getMyStories = catchAsync(async (req, res, next) => {
	const doc = await Story.find({ user: req.user.id });

	res.status(200).json({
		status: 'success',
		data: {
			data: doc,
		},
	});
});

// Controller to get stories by a specific user id
exports.getStoriesByUserId = catchAsync(async (req, res, next) => {
	const doc = await Story.find({ user: req.params.id });

	res.status(200).json({
		status: 'success',
		data: {
			data: doc,
		},
	});
});

// Controller to get stories by followers and followings of the logged-in user
exports.getStoriesByFollows = catchAsync(async (req, res, next) => {
	const user = await User.findOne({ _id: req.user.id }).populate({
		path: 'followers followings',
	});

	const followerIds = user.followers.map((follower) => follower.self._id);
	const followingIds = user.followings.map((following) => following.to._id);
	const allUserIds = [...followerIds, ...followingIds];

	const stories = await Story.find({ user: { $in: allUserIds } });

	res.status(200).json({
		status: 'success',
		data: {
			data: stories,
		},
	});
});

exports.uploadImg = uploadImageInStory.single('url');

// Create a new story
// exports.createStory = factory.createOne(Story);

exports.createStory = catchAsync(async (req, res, next) => {
	const userProfile = await User.findById(req.user.id);
	if (!userProfile) {
		return next(new AppError(`Please create an account`, 404));
	}
	if (!req.body.user) req.body.user = userProfile;

	const key = req.file.key;
	const url = `https://${process.env.BUCKET_NAME}.s3.amazonaws.com/${key}`;

	const doc = await Story.create({ ...req.body, url });
	res.status(201).json({
		status: 'success',
		data: {
			data: doc,
		},
	});
});

exports.deletePhoto = catchAsync(async (req, res, next) => {
	const story = await Story.findById(req.params.id);

	const parts = story.url.split(
		`https://${process.env.BUCKET_NAME}.s3.amazonaws.com/`
	);
	const key = parts[1];

	const params = {
		Bucket: `${process.env.BUCKET_NAME}`,
		Key: key,
	};
	s3.deleteObject(params, (err, data) => {
		if (err) {
			console.log(err);
		} else {
			console.log(data);
		}
	});
	next();
});

// Delete a story
exports.deleteStory = factory.deleteOne(Story);

exports.getAllStories = factory.getAll(Story);

exports.getAllStoriesByUsers = catchAsync(async (req, res, next) => {
	const doc = await Story.find();

	const storiesByUser = {};

	doc.forEach((story) => {
		const userId = story.user._id;

		if (!storiesByUser[userId]) {
			storiesByUser[userId] = [];
		}

		storiesByUser[userId].push(story);
	});

	res.status(200).json({
		status: 'success',
		data: {
			data: storiesByUser,
		},
	});
});
