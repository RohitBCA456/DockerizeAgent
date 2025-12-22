import mongoose from "mongoose";

export const connectDB = async () => {
  try {
    const connectionInstance = await mongoose.connect(
      `${process.env.DB_URI}/${process.env.DB_NAME}`,
    );

    if (!connectionInstance) {
      console.log("something went wrong while connecting the database.");
    }

    console.log(
      `database connected to : ${connectionInstance.connection.host}`
    );
  } catch (error) {
    console.log(`error while connecting to database, ${error}`);
  }
};
