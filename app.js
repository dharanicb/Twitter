const express = require("express");
const path = require("path");
// const format = require("date-fns/format");
// const addDays = require("date-fns/addDays");
// const isMatch = require("date-fns/isMatch");
// var isValid = require("date-fns/isValid");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const app = express();

app.use(express.json());

const dbPath = path.join(__dirname, "twitterClone.db");

let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

// api 3
const authenticateToken = (request, response, next) => {
  let { username, password } = request;
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwt.verify(jwtToken, `'${password}'`, async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid Request");
      } else {
        request.username = payload.username;
        next();
      }
    });
  }
};

// api 1
app.post("/register", async (request, response) => {
  let { username, name, password, gender } = request.body; //Destructuring the data from the API call

  let hashedPassword = await bcrypt.hash(password, 10); //Hashing the given password

  let checkTheUsername = `
            SELECT *
            FROM user
            WHERE username = '${username}';`;
  let userData = await db.get(checkTheUsername);
  if (userData === undefined) {
    let postNewUserQuery = `
            INSERT INTO
            user (username,name,password,gender)
            VALUES (
                '${username}',
                '${name}',
                '${hashedPassword}',
                '${gender}'
            );`;
    if (password.length < 6) {
      //checking the length of the password
      response.status(400);
      response.send("Password is too short");
    } else {
      /*If password length is greater than 5 then this block will execute*/

      let newUserDetails = await db.run(postNewUserQuery); //Updating data to the database
      response.status(200);
      response.send("User created successfully");
    }
  } else {
    /*If the userData is already registered in the database then this block will execute*/
    response.status(400);
    response.send("User already exists");
  }
});

// api 2

app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `SELECT * FROM user WHERE username = '${username}'`;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (isPasswordMatched === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, `'${password}'`);
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

// api 3

app.get("/user/tweets/feed/", async (request, response) => {
  const {
    username,
    tweet,
    date_time,
    user_id,
    limit = "4",
    offset = "2",
  } = request;
  const getTweetsQuery = `
   SELECT
        user.username, tweet.tweet, tweet.date_time AS dateTime
    FROM
        follower
     INNER JOIN tweet
        ON follower.following_user_id = tweet.user_id
     INNER JOIN user
        ON tweet.user_id = user.user_id
  WHERE
        follower.follower_user_id = 1
     ORDER BY
    tweet.date_time DESC
    LIMIT 4;`;
  const tweetArray = await db.all(getTweetsQuery);
  response.send(tweetArray);
});

// api 4

app.get("/user/following/", authenticateToken, async (request, response) => {
  const { name, follower_id, user_id } = request;
  const getFollowerQuery = `
   SELECT
     name
   FROM
    user;`;
  const followerArray = await db.all(getFollowerQuery);
  response.send(followerArray);
});

// api 5

app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { name, follower_id, user_id } = request;
  const getFollowerQuery = `
   SELECT
     name
   FROM
    user;`;
  const followerArray = await db.all(getFollowerQuery);
  response.send(followerArray);
});

// api 6

app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId, name, follower_id, user_id } = request;
  const getFollowerQuery = `
   SELECT
     tweet.tweet AS tweet ,
     count(like.tweet_id) AS likes,
     count(reply.tweet_id) AS replies,
     tweet.date_time AS dateTime
   FROM
    (tweet INNER JOIN like on tweet.tweet_id = like.tweet_id) AS T
    INNER JOIN reply ON T.tweet_id = reply.tweet_id
    ORDER BY T.tweet_id DESC;`;
  const followerArray = await db.all(getFollowerQuery);
  response.send(followerArray);
});

// api 7

app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId, tweets } = request;
    const getTweetsLikeQuery = `
   SELECT
    tweet.tweet AS likes
   FROM
    tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id
   ORDER BY
    tweet.tweet_id DESC;`;
    const tweetLikeArray = await db.all(getTweetsLikeQuery);
    response.send(tweetLikeArray);
  }
);

// api 8

app.get(
  "/tweets/:tweetId/replies/",
  authenticateToken,
  async (request, response) => {
    const { tweetId, tweets, name } = request;
    const getTweetsReplayQuery = `
   SELECT
    user.name AS name
    reply.reply AS reply
   FROM
    user INNER JOIN reply ON user.user_id = reply.user_id
   ORDER BY
    user.user_id DESC;`;
    const replies = await db.all(getTweetsReplayQuery);
    response.send([{ replies }]);
  }
);

// api 9

app.get("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweetId, name, follower_id, user_id } = request;
  const getFollowerQuery = `
   SELECT
     tweet.tweet AS tweet ,
     count(like.tweet_id) AS likes,
     count(reply.tweet_id) AS replies,
     tweet.date_time AS dateTime
   FROM
    (tweet INNER JOIN like on tweet.tweet_id = like.tweet_id) AS T
    INNER JOIN reply ON T.tweet_id = reply.tweet_id
    ORDER BY T.tweet_id DESC;`;
  const followerArray = await db.all(getFollowerQuery);
  response.send(followerArray);
});

// api 10

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { tweet } = request.body;
  const addTweetQuery = `
    INSERT INTO
      tweet (tweet)
    VALUES
      (
        '${tweet}'
      );`;

  const dbResponse = await db.run(addTweetQuery);
  const tweetId = dbResponse.lastID;
  response.send("Created a Tweet");
});

// api 11

app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const deleteTweetQuery = `
    DELETE FROM
      tweet
    WHERE
      tweet_id = ${tweetId};`;
    await db.run(deleteTweetQuery);
    response.send("Tweet Removed");
  }
);
module.exports = app;
