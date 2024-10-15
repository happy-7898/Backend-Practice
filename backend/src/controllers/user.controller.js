import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import uploadOnCloudnary from "../utils/cloudinary.js";
import ApiResponse from "../utils/ApiResponse.js";

const registerUser=asyncHandler(async (req,res)=>{
    const {username,email,password,fullName}=req.body;
    // console.log(email);

    if(
        [username,fullName,email,password].some((field)=>field?.trim()==="")
    ){
        throw new ApiError(400,"All fields are required");
    }

    const existedUser=User.findOne({
        $or:[{username},{email}],
    })

    if(existedUser){
        throw new ApiError(409,"Email or UserName already existed");
    }

    const avatarLocalPath=req.files?.avatar[0]?.path;
    const coverImageLocalPath=req.files?.coverImage[0]?.path;

    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar is required");
    }

    const avatar=await uploadOnCloudnary(avatarLocalPath);
    const coverImage=await uploadOnCloudnary(coverImageLocalPath);

    if(!avatar){
        throw new ApiError(400,"Avatar required")
    }

    const user= await User.create({
        fullName,
        username:username.toLowerCase(),
        email,
        password,
        avatar:avatar.url,
        coverImage:coverImage?.url || ""
    })

    const createdUser=await User.findById(user._id).select(
        "-password -refreshToken"
    )

    if(!createdUser){
        throw new ApiError(500,"Something went wrong while registering user");
    }

    return res.status(201).json(
        new ApiResponse(201,createdUser,"User registered successfully")
    )

})

export {registerUser}