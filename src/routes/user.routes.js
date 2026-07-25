import { Router } from "express";
import uploadOnServerByMulter from "../middlewares/multer.middleware.js";
import verifyJWT from "../middlewares/auth.middleware.js";
import {
    updateUserAvatar,
    updateUserCoverImage,
    updateUserInfo,
    changeUserPassword,
    getCurrentUser,
    getUserChannelProfile,
    loginUser,
    logoutUser,
    refreshAccessToken,
    registerUser,
    getWatchHistory
} from "../controllers/user.controller.js";

const userRouter = Router();

// public routes

// For user register
userRouter.route("/register").post(
    uploadOnServerByMulter.fields([
        {
            name: "avatar",
            maxCount: 1
        },
        {
            name: "coverImage",
            maxCount: 1
        }
    ]),
    registerUser
);

// For user login
userRouter.route("/login").post(loginUser);

// secured routes

// For user logout
userRouter.route("/logout").get(verifyJWT, logoutUser);

// For user can refresh its jwt token
userRouter.route("/refresh-token").get(refreshAccessToken);

// For user can change password of his account
userRouter.route("/change-password").post(verifyJWT, changeUserPassword);

// For user can see his profile
userRouter.route("/current-user").get(verifyJWT, getCurrentUser);

// For user can update his account details
userRouter.route("/update-account").patch(verifyJWT, updateUserInfo);

// For user can update his account avatar image
userRouter.route("/update-avatar").patch(verifyJWT, uploadOnServerByMulter.single("avatar"), updateUserAvatar);

// For user can update his account cover image
userRouter.route("/update-cover-image").patch(verifyJWT, uploadOnServerByMulter.single("coverImage"), updateUserCoverImage);

// For user can see his subscribers and subscribed channels count
userRouter.route("/channel/:username").get(verifyJWT, getUserChannelProfile);

// For user can see his watch history
userRouter.route("/history").get(verifyJWT, getWatchHistory);

export default userRouter;