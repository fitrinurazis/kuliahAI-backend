require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const authRoutes = require("./routes/authRoutes");

const { sequelize } = require("./models");

sequelize
  .authenticate()
  .then(() => {
    console.log("database connection has been established successfully");
  })
  .catch((error) => {
    console.log("connection error", error);
  });

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.use(cors({ origin: true, credentials: true }));

app.use("/api/auth", authRoutes);

app.listen(process.env.SERVER_PORT, () => {
  console.log("Server Running");
});
