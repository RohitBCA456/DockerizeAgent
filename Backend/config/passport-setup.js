import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { User } from "../model/user.model.js";
import dotenv from "dotenv";

dotenv.config();

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});
let GOOGLE_OAUTH_ENABLED = false;
try {
  const clientID = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (clientID && clientSecret) {
    passport.use(
      new GoogleStrategy(
        {
          clientID,
          clientSecret,
          callbackURL: "/auth/google/callback",
        },
        async (accessToken, refreshToken, profile, done) => {
          try {
            let user = await User.findOne({ googleId: profile.id });
            if (user) {
              return done(null, user);
            } else {
              const newUser = await new User({
                googleId: profile.id,
                displayName: profile.displayName,
                email: profile.emails[0].value,
                image: profile.photos[0].value,
              }).save();
              return done(null, newUser);
            }
          } catch (err) {
            return done(err, null);
          }
        }
      )
    );
    GOOGLE_OAUTH_ENABLED = true;
  } else {
    console.warn('Google OAuth not configured - missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
    GOOGLE_OAUTH_ENABLED = false;
  }
} catch (e) {
  console.error('Failed to initialize Google OAuth strategy:', e && e.message ? e.message : e);
  GOOGLE_OAUTH_ENABLED = false;
}

export { GOOGLE_OAUTH_ENABLED };
