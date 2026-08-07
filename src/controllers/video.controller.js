import mongoose, { isValidObjectId } from "mongoose"
import Video from "../models/video.model.js"
import User from "../models/user.model.js"
import ApiError from "../utils/ApiError.js"
import ApiResponse from "../utils/ApiResponse.js"
import asyncHandler from "../utils/asyncHandler.js"
import uploadOnCloudinary from "../utils/cloudinary.js"

// Helper function
const checkVideoId = async (videoId) => {
    if (!videoId || videoId === "") {
        throw new ApiError(400, "Video Id is required.");
    } else if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Video Id is not valid.");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video does not exist.");
    }

    return video;
};

const getAllVideos = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 10,
        query = "",
        sortBy = "createdBy",
        sortType = "desc"
    } = req.query;

    const videos = Video.aggregate([
        {
            $match: {
                isPublished: true,
                owner: req.user?._id,
                title: {
                    $regex: query,
                    $options: "i"
                }
            }
        },
        {
            $sort: {
                [sortBy]: (sortType === "asc") ? 1 : -1
            }
        },
        {
            $lookup: {
                from: "users",
                foreignField: "_id",
                localField: "owner",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            fullname: 1,
                            username: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$owner"
        }
    ]);

    const allVideos = await Video.aggregatePaginate(
        videos,
        {
            page,
            limit
        }
    );

    return res
        .status(200)
        .json(new ApiResponse(200, allVideos, "Videos fetched successfully.")
        );
})

const publishAVideo = asyncHandler(async (req, res) => {
    // TODO: get video, upload to cloudinary, create video
    const { title, description } = req.body;

    if (!title || title === "") {
        throw new ApiError(400, "Video Title is required.");
    } else if (!description || description === "") {
        throw new ApiError(400, "Video Description is required.");
    }

    const videoFileLocalPath = req.files?.videoFile?.[0]?.path;
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

    if (!videoFileLocalPath) {
        throw new ApiError(400, "Error in uploading video.");
    } else if (!thumbnailLocalPath) {
        throw new ApiError(400, "Error in uploading thumbnail.");
    }

    const videoFile = await uploadOnCloudinary(videoFileLocalPath);
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if (!videoFile) {
        throw new ApiError(400, "Error in uploading video to cloud.");
    } else if (!thumbnail) {
        throw new ApiError(400, "Error in uploading thumbnail to cloud.");
    }

    const owner = req.user?._id;

    if (!owner) {
        throw new ApiError(400, "User is not authorized.");
    }

    const video = await Video.create({
        videoFile: videoFile.secure_url,
        thumbnail: thumbnail.secure_url,
        title,
        description,
        duration: videoFile.duration,
        views: 0,
        isPublished: false,
        owner
    });

    const uploadedVideo = await Video.findById(video._id);

    if (!uploadedVideo) {
        throw new ApiError(500, "Video not uploaded.");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, uploadedVideo, "Video uploaded successfully.",)
        );
})

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    const video = await checkVideoId(videoId);

    return res
        .status(200)
        .json(
            new ApiResponse(200, video, "Video fetched successfully.")
        );
})

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { title, description } = req.body;

    if (!title || title === "") {
        throw new ApiError(400, "Video Title is required.");
    } else if (!description || description === "") {
        throw new ApiError(400, "Video Description is required.");
    }

    const thumbnailLocalPath = req.file?.path;

    if (!thumbnailLocalPath) {
        throw new ApiError(400, "Error in uploading thumbnail.");
    }

    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if (!thumbnail) {
        throw new ApiError(400, "Error in uploading thumbnail to cloud.");
    }

    const video = await checkVideoId(videoId);

    if (video.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this video.");
    }

    video.title = title;
    video.description = description;
    video.thumbnail = thumbnail.secure_url;
    video.save({ ValiditeBeforeSave: false });

    return res
        .status(200)
        .json(
            new ApiResponse(200, video, "Video updated successfully.",)
        );

})

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    const video = await checkVideoId(videoId);

    if (video.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You are not authorized to delete this video.");
    }

    await Video.findByIdAndDelete(videoId);

    return res
        .status(200)
        .json(
            new ApiResponse(200, {}, "Video deleted successfully.")
        );
})

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    const video = await checkVideoId(videoId);

    video.isPublished = !video.isPublished;

    video.save({ ValiditeBeforeSave: false });

    return res
        .status(200)
        .json(
            new ApiResponse(200, video.isPublished, "Video publish status updated successfully.",)
        );
})

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
}
