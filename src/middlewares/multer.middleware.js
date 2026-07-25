import multer from "multer";

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "./public/temp");
    },
    filename: function (req, file, cb) {
        cb(null, file.originalname)
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        // Images
        "image/jpeg",
        "image/png",
        "image/webp",

        // Videos
        "video/mp4",
        "video/webm",
        "video/ogg",
        "video/quicktime", // .mov
        "video/x-msvideo", // .avi
        "video/x-matroska" // .mkv
    ];

    if (!allowedTypes.includes(file.mimetype)) {
        return cb(
            new Error(
                "Only JPG, PNG, WEBP images and MP4, WEBM, OGG, MOV, AVI, MKV videos are allowed."
            )
        );
    }

    cb(null, true);
};

const uploadOnServerByMulter = multer(
    {
        storage: storage,
        limits: {
            fileSize: 100 * 1024 * 1024 // 5 MB
        },
        fileFilter
    }
);

export default uploadOnServerByMulter;