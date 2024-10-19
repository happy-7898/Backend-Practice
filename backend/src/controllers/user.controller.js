import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import uploadOnCloudnary from "../utils/cloudinary.js";
import ApiResponse from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";


const generateAccessAndRefreshToken=async (userId)=>{
    try {
        const user=await User.findById(userId);
        const accessToken=user.generateAccessToken();
        const refreshToken=user.generateRefreshToken();

        user.refreshToken=refreshToken;
        await user.save({validateBeforeSave:false})
        return {refreshToken,accessToken}

    } catch (error) {
        throw new ApiError(500,"Something went wrong while generating access and refresh token");
    }
}

const registerUser=asyncHandler(async (req,res)=>{
    const {username,email,password,fullName}=req.body;
    // console.log(email);

    if(
        [username,fullName,email,password].some((field)=>field?.trim()==="")
    ){
        throw new ApiError(400,"All fields are required");
    }

    const existedUser=await User.findOne({
        $or:[{username},{email}],
    })

    if(existedUser){
        throw new ApiError(409,"Email or UserName already existed");
    }

    const avatarLocalPath=req.files?.avatar[0]?.path;
    // const coverImageLocalPath=req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
        coverImageLocalPath=req.files?.coverImage[0].path;
    }

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

const loginUser=asyncHandler(async (req,res)=>{

    const {username,email,password}=req.body;

    if(!(username || email)){
        throw new ApiError(400,"Email or Username is required");
    }

    const user=await User.findOne({
        $or:[{username},{email}]
    })

    if(!user){
        throw new ApiError(404,"User does not exist")
    }

    const isPasswordValid=await user.isPasswordCorrect(password);

    if(!isPasswordValid){
        throw new ApiError(401,"Password is not Correct");
    }

    const {accessToken,refreshToken}=await generateAccessAndRefreshToken(user._id);

    const loggedInUser=await User.findById(user._id).select("-password -refreshToken");

    const options={
        httpOnly:true,
        secure:true,
    }

    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken,options)
    .json(
        new ApiResponse(
            200,
            {
                user:loggedInUser,
                accessToken,
                refreshToken
            },
            "User Logged In Successfully"
        )
    )

})


const logoutUser=asyncHandler(async (req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken:undefined
            }
        },
        {
            new:true,
        }
    )

    const options={
        httpOnly:true,
        secure:true,
    }

    return res.status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(
        new ApiResponse(200,{},"User Logged Out successfully")
    )
})


const refreshAccessToken=asyncHandler(async (req,res)=>{
    const incomingRefreshToken=req.cookies.refreshToken || req.body.refreshToken;

    if(!incomingRefreshToken){
        throw new ApiError(401,"Unauthorized Access");
    }

    try {
        const decodedToken=jwt.verify(incomingRefreshToken,process.env.REFRESH_TOKEN_SECRET);
    
        const user= await User.findById(decodedToken?._id);
    
        if(!user){
            throw new ApiError(401,"Invalid Refresh Token");
        }
    
        if(incomingRefreshToken!==user?.refreshToken){
            throw new ApiError(401,"Refresh Token is expired or used");
        }
    
        const options={
            httpOnly:true,
            secure:true
        }
    
        const {accessToken,newRefreshToken}=await generateAccessAndRefreshToken(user._id);
    
        return res
        .status(200)
        .cookie("accessToken",accessToken,options)
        .cookie("refreshToken",newRefreshToken,options)
        .json(
            new ApiResponse(
                200,
                {
                    accessToken,
                    refreshToken:newRefreshToken,
                    
                },
                "Access Token Refreshed"
            )
        )
    } catch (error) {
        throw new ApiError(401,error?.message || "Refresh Token Invalid");
    }
})


const changeCurrentPassword=asyncHandler(async (req,res)=>{
    const {oldPassword,newPassword}=req.body;

    const user=await User.findById(req.user?._id);

    const isPasswordCorrect=await User.isPasswordCorrect(oldPassword);

    if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid Old Password");
    }

    user.password=newPassword;
    await user.save({validateBeforeSave:false});

    return res.status(200).json(new ApiResponse(200,{},"Password Changed successfully"));
})


const getCurrentUser=asyncHandler(async (req,res)=>{
    return res.status(200).json(new ApiResponse(200,req.user,"Current User fetched Successfully"));
})

const updateAccountDetails=asyncHandler(async (req,res)=>{
    const {fullName,email}=req.body;

    if(!fullName || !email){
        throw new ApiError(400,"All fields are required");
    }

    const user=User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName,
                email:email
            }
        },
        {
            new:true
        }
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200,user,"User details updated successfully"))
})

const updateUserAvatar=asyncHandler(async (req,res)=>{
    const avatarPath=req.file?.path;

    if(!avatarPath){
        throw new ApiError(400,"Avatar file is missing")
    }

    const avatar=await uploadOnCloudnary(avatarPath);

    if(!avatar.url){
        throw new ApiError(400,"Error while updating avatar");
    }

    const user=await User.findByIdAndUpdate(
       req.user?._id,
       {
            $set:{
                avatar:avatar.url
            }
       },
       {
            new:true
       } 
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200,user,"Avatar updated successfully")
    )

})

const updateUserCoverImage=asyncHandler(async (req,res)=>{
    const coverImagePath=req.file?.path;

    if(!coverImagePath){
        throw new ApiError(400,"Cover Image file is missing")
    }

    const coverImage=await uploadOnCloudnary(coverImagePath);

    if(!coverImage.url){
        throw new ApiError(400,"Error while updating Cover Image");
    }

    const user=await User.findByIdAndUpdate(
       req.user?._id,
       {
            $set:{
                coverImage:coverImage.url
            }
       },
       {
            new:true
       } 
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200,user,"Cover Image updated successfully")
    )

})

const getUserChannelProfile=asyncHandler(async(req,res)=>{
    const {username}=req.params;

    if(!username?.trim()){
        throw new ApiError(400,"Username is missing ")
    }

    const channel=User.aggregate(
        [
            {
                $match:{
                    username:username.toLowerCase()
                }
            },
            {
                $lookup:{
                    from:"subscriptions",
                    localField:"_id",
                    foreignField:"channel",
                    as:"subscribers"
                }
            },
            {
                $lookup:{
                    from:"subscriptions",
                    localField:"_id",
                    foreignField:"subscriber",
                    as:"subscribedTo"
                }
            },
            {
                $addFields:{
                    subscribersCount:{
                        $size:"$subscribers"
                    },
                    channelsSubscribedTo:{
                        $size:"$subscribedTo"
                    },
                    isSubscribed:{
                        $cond:{
                            if:{$in:[req.user?._id,"$subscribers.subscriber"]},
                            then:true,
                            else:false
                        }
                    }
                }
            },
            {
                $project:{
                    username:1,
                    fullName:1,
                    email:1,
                    avatar:1,
                    coverImage:1,
                    subscribersCount:1,
                    channelsSubscribedTo:1,
                    isSubscribed:1,
                }
            }
        ]
    )

    if(!channel?.length){
        throw new ApiError(404,"Channel does not exists");
    }

    return res
    .status(200)
    .json(
        new ApiResponse(200,channel[0],"Channel details fetched successfully")
    )
})

const getWatchHistory=asyncHandler(async(req,res)=>{
    const user=await User.aggregate(
        [
            {
                $match:{
                    id:new mongoose.Types.ObjectId(req.user._id);
                }
            },
            {
                $lookup:{
                    from:"videos",
                    localField:"watchHistory",
                    foreignField:"_id",
                    as:"watchHistory",
                    pipeline:[
                        {
                            $lookup:{
                                from:"users",
                                localField:"owner",
                                foreignField:"_id",
                                as:"owner",
                                pipeline:[
                                    {
                                        $project:{
                                            fullName:1,
                                            username:1,
                                            avatar:1,
                                        }
                                    }
                                ]
                            }
                        },
                        {
                            $addFields:{
                                owner:{
                                    $first:"$owner"
                                }
                            }
                        }
                    ]
                }
            }
        ]
    )

    return res
    .status(200)
    .json(
        new ApiResponse(200,user[0].watchHistory,"Watch History fetched successfully")
    )
})
export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory
}