import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import User from "../models/user.model.js";
import uploadOnCloudinary from "../utils/cloudinary.js";
import ApiResponse from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const options = {
    httpOnly: true,
    secure: true
}

//Helper Function v1
// const generateAccessAndRefreshTokens = async (userId) => {
//     try {
//         const user = await User.findById(userId);

//         const accessToken = await user.generateAccessToken();
//         const refreshToken = await user.generateRefreshToken();

//         user.refreshToken = refreshToken;

//         await user.save({ ValiditeBeforeSave: false });

//         return { accessToken, refreshToken };
//     } catch (error) {
//         throw new ApiError(500, `Error in generating Access Token and Refresh Token: ${error.message}`);
//     }
// }

//Helper Function v2 - my version
const generateAccessAndRefreshTokens = async (user) => {
    try {
        const accessToken = await user.generateAccessToken();
        const refreshToken = await user.generateRefreshToken();

        user.refreshToken = refreshToken;

        await user.save({ ValiditeBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(500, `Error in generating Access Token and Refresh Token: ${error.message}.`);
    }
}

// Register User Function
const registerUser = asyncHandler(async (req, res) => {
    // get user details from frontend
    const { username, fullname, email, password } = req.body;

    // validation - not empty
    if (!username || username === "") {
        throw new ApiError(400, "Username is required.");
    } else if (!fullname || fullname === "") {
        throw new ApiError(400, "Fullname is required.");
    } else if (!email || email === "") {
        throw new ApiError(400, "Email is required.");
    } else if (!password || password === "") {
        throw new ApiError(400, "Password is required.");
    }

    // check if user already exists: username, email
    const existedUser = await User.findOne({
        $or: [{ email }, { username }] // checks if email or username match with any other email or username
    });

    if (existedUser) {
        throw new ApiError(409, "User already exist.");
    }

    // check for images, check for avatar
    const avatarLocalPath = req.files?.avatar?.[0]?.path;
    const coverImageLocalPath = req.files?.coverImage?.[0]?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Error in uploading avatar image.");
    }

    // upload them to cloudinary, avatar
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new ApiError(400, "Error in uploading avatar image to cloud.");
    }

    // create user object – create entry in db
    const newUser = await User.create({
        username: username.toLowerCase(),
        email,
        fullname,
        password,
        avatar: avatar.secure_url,
        coverImage: coverImage?.secure_url || ""
    })

    // check for user creation
    const createdUser = await User.findById(newUser._id).select(
        "-password -refeshToken -passwordHistory" // remove password and refresh token field from response
    );
    if (!createdUser) {
        throw new ApiError(500, "User not created.");
    }

    // return res
    return res
        .status(201)
        .json(
            new ApiResponse(200, "User registered successfully.", createdUser)
        );
});

// Login User Function
const loginUser = asyncHandler(async (req, res) => {
    // get user details form frontend username/email, password
    const { username, email, password } = req.body;

    // validation - not empty
    if (!username || username === "" || !email || email === "") {
        throw new ApiError(400, "Username or Email is required.");
    } else if (!password || password === "") {
        throw new ApiError(400, "Password is required.");
    }

    // check username/email ans password from the database
    const userExist = await User.findOne({
        $or: [{ username }, { email }] // find user by username or email
    });

    if (!userExist) {
        throw new ApiError(400, "User does not exist.");
    }

    const passwordCheck = await userExist.isPasswordCorrect(password);

    if (!passwordCheck) {
        throw new ApiError(400, "Password is incorrect.");
    }

    // check the access token, if new user then generate it
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(userExist);

    // Update the user (Either can update the previously find User or find again the user which will be updated)

    // Method 1: it is good but we are sending passwordHistory and refreshToken to the user
    // userExist.refreshToken = refreshToken;
    // userExist.accessToken = accessToken;
    // userExist.save({ ValiditeBeforeSave: false });

    // Method 2:
    const loggedInUser = await User.findById(userExist._id).select("-password -refreshToken -passwordHistory");

    // send successful response
    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(new ApiResponse(200, "User logged in successfully.", {
            user: loggedInUser,
            accessToken,
            refreshToken
        }));
});

// Logout User Function
const logoutUser = asyncHandler(async (req, res) => {
    const user = await User.findByIdAndUpdate(req.user._id, {
        $set: {
            refreshToken: undefined
        }
    });

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged out successfully."));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken = req.cookies?.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized request.");
    }

    try {
        const decodedToken = await jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET);

        const foundedUser = await User.findById(decodedToken?._id);

        if (!foundedUser) {
            throw new ApiError(401, "Invalid refresh token.");
        }

        if (incomingRefreshToken !== foundedUser?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used.");
        }

        const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(foundedUser);

        foundedUser.refreshToken = refreshToken;
        foundedUser.accessToken = accessToken;
        foundedUser.save({ ValiditeBeforeSave: false });

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json(new ApiResponse(200, "Access token refreshed successfully.", {
                accessToken,
                refreshToken
            }));
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token.");
    }
});

const changeUserPassword = asyncHandler(async (req, res) => {
    // getting details from frontend
    const { oldPassword, newPassword, confirmPassword } = req.body;
    console.log(`oldPassword: ${oldPassword}`);
    // validation - not empty
    if (!oldPassword || oldPassword === "") {
        throw new ApiError(400, "Old Password is required.");
    } else if (!newPassword || newPassword === "") {
        throw new ApiError(400, "New Password is required.");
    } else if (!confirmPassword || confirmPassword === "") {
        throw new ApiError(400, "Confirm Password is required.");
    } else if (!(newPassword === confirmPassword)) {
        throw new ApiError(400, "Confirm Password does not match pasword.");
    }

    const user = await User.findById(req.user?._id);

    if (!user) {
        throw new ApiError(400, "User does not exist.");
    }

    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Old Password is incorrect.");
    }

    const isOldPassword = await user.isOldPassword(newPassword);

    if (isOldPassword) {
        throw new ApiError(400, "This password is used before try another password.");
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "User password changed successfully."));
});

const getCurrentUser = asyncHandler(async (req, res) => {
    const user = req.user;

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Current user fetched successfully."));
});

const updateUserInfo = asyncHandler(async (req, res) => {

    const { fullname, email } = req.body;

    // validation - not empty
    if ((!fullname && fullname === "") && (!email || email === "")) {
        throw new ApiError(400, "Fullname and Email is required.");
    } else if (fullname === "") {
        throw new ApiError(400, "Fullname cannot be empty.");
    } else if (email === "") {
        throw new ApiError(400, "Email cannot be empty.");
    }

    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname,
                email
            }
        },
        { new: true }
    ).select("-password -refreshToken -passwordHistory");

    return res
        .status(200)
        .json(new ApiResponse(200, updatedUser, "User info updated successfully."));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar image is required.");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if (!avatar) {
        throw new ApiError(400, "Error uploading avatar.");
    }

    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.secure_url
            }
        },
        { new: true }
    ).select("-password -refreshToken -passwordHistory");

    // TODO: delete old avatar image on cloudinary

    return res
        .status(200)
        .json(new ApiResponse(200, updatedUser, "User avatar updated successfully."));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover Image image is required.");
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!coverImage) {
        throw new ApiError(400, "Error uploading Cover Image.");
    }

    const updatedUser = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.secure_url
            }
        },
        { new: true }
    ).select("-password -refreshToken -passwordHistory");

    // TODO: delete old avatar image on cloudinary

    return res
        .status(200)
        .json(new ApiResponse(200, updatedUser, "User Cover Image updated successfully."));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;

    if (!username?.trim()) {
        throw new ApiError(400, "Username is missing in the url.");
    }

    const channel = await User.aggregate([
        // aggregation pipeline 1
        {
            $match: {
                username: username?.toLowerCase()
            }
        },
        // aggregation pipeline 2
        {
            $lookup: {
                from: "subscriptions",
                foreignField: "channel",
                localField: "_id",
                as: "subscribers"
            }
        },
        // aggregation pipeline 3
        {
            $lookup: {
                from: "subscriptions",
                foreignField: "subscriber",
                localField: "_id",
                as: "subscribedTo"
            }
        },
        // aggregation pipeline 4
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers"
                },
                subscribedToCount: {
                    $size: "$subscribedTo"
                },
                isSubscribed: {
                    $cond: {
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] },
                        then: true,
                        else: false
                    }
                }
            }
        },
        {
            $project: {
                fullname: 1,
                username: 1,
                email: 1,
                avatar: 1,
                coverImage: 1,
                createdAt: 1,
                subscribersCount: 1,
                subscribedToCount: 1,
                isSubscribed: 1
            }
        }
    ]);

    if (!channel?.length) {
        throw new ApiError(404, "Channel does not exist.");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, channel[0], "User channel fetched successfully."))
});

const getWatchHistory = asyncHandler(async (req, res) => {
    const user = await User.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.user?._id)
            }
        },
        {
            $lookup: {
                from: "videos",
                foreignField: "_id",
                localField: "watchHistory",
                as: "watchHistory",
                pipeline: [
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
                        $addFields: {
                            owner: {
                                $first: "$owner"
                            }
                        }
                    }
                ]
            }
        }
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, user[0].watchHistory, "User watch history fetched successfully."));
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeUserPassword,
    getCurrentUser,
    updateUserInfo,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
};

// TODO: Write the middleware to handle error type of multer