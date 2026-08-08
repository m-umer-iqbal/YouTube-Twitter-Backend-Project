import mongoose, { isValidObjectId } from "mongoose"
import Playlist from "../models/playlist.model.js"
import ApiError from "../utils/ApiError.js"
import ApiResponse from "../utils/ApiResponse.js"
import asyncHandler from "../utils/asyncHandler.js"
import User from "../models/user.model.js"

// Helper function
const checkPlaylistId = async (playlistId) => {
    if (!playlistId || playlistId === "") {
        throw new ApiError(400, "Playlist Id is required.");
    } else if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Playlist Id is not valid.");
    }

    const playlist = await Playlist.findById(playlistId);

    if (!playlist) {
        throw new ApiError(404, "Playlist does not exist.");
    }

    return playlist;
};

const createPlaylist = asyncHandler(async (req, res) => {
    const { name, description } = req.body;

    if (!name || name === "") {
        throw new ApiError(400, "Playlist name is required.");
    } else if (!description || description === "") {
        throw new ApiError(400, "Playlist description is required.");
    }

    const existedPlaylist = await Playlist.findOne({ name });

    if (existedPlaylist) {
        throw new ApiError(409, "Playlist already exist.");
    }

    const playlist = await Playlist.create({
        name,
        description,
        owner: req.user?._id
    });

    if (!playlist) {
        throw new ApiError(500, "Playlist not created.");
    }

    return res
        .status(201)
        .json(
            new ApiResponse(200, playlist, "Playlist created successfully.")
        );
})

const getUserPlaylists = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    if (!userId || userId === "") {
        throw new ApiError(400, "User Id is required.");
    } else if (!isValidObjectId(userId)) {
        throw new ApiError(400, "User Id is not valid.");
    }

    const user = await User.findById(userId);

    if (!user) {
        throw new ApiError(404, "User does not exist.");
    }

    const playlists = await Playlist.find({
        owner: userId
    });

    if (!playlists || playlists.length === 0) {
        throw new ApiError(404, "No playlist exist.");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, playlists, "Playlists fetched successfully.")
        );
});

const getPlaylistById = asyncHandler(async (req, res) => {
    const { playlistId } = req.params
    //TODO: get playlist by id
})

const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params
})

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params
    // TODO: remove video from playlist

})

const deletePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params
    // TODO: delete playlist
})

const updatePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params
    const { name, description } = req.body
    //TODO: update playlist
})

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
}
