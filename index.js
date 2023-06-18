const express = require('express')
const app = express()
const microsoftComputerVision = require('microsoft-computer-vision')
const path = require('path')
const upload = require('./imageupload.config')
const Image = require('./models/image')
const mongoose = require('mongoose')
const User = require('./models/user')
const ejsMate = require('ejs-mate')
const cookieParser = require('cookie-parser');
const flash = require('connect-flash')
const passport = require('passport')
const session = require('express-session')
const MongoStore = require('connect-mongo');

require('dotenv').config()

const sessionstore = new MongoStore({
    mongoUrl: process.env.MONGODB_URL,
    ttl: 1000 * 60 * 60 * 24
})

const sessionOptions = {
    secret: 'keyboardcat',
    resave: false,
    saveUninitialized: true,
    store: sessionstore,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24
    }
}


mongoose.connect(process.env.MONGODB_URL)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.log(err))


app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'))
app.engine('ejs', ejsMate)


app.use(cookieParser());

const renderHomePage = (req, res) => {
    res.render('home')
}

app.use(express.urlencoded({ extended: true }))

app.use(session(sessionOptions))

app.use(passport.initialize())
app.use(passport.session())

passport.use(User.createStrategy())
passport.serializeUser(User.serializeUser())
passport.deserializeUser(User.deserializeUser())

app.use(flash())

const registerPage = (req, res) => {
    res.render('register')
}

const processUploadedImage = async (req, res) => {
    let { lat, lng, desc } = req.body

    console.log('hello', req.body)

    const pnt = {
        type: 'Point',
        coordinates: [lat, lng]
    }
    const imgUrl = req.file.url
    const imageOptions = {
        "Ocp-Apim-Subscription-Key": process.env.VISION_API_KEY,
        "request-origin": process.env.VISION_API_REGION,
        "content-type": "application/json",
        "url": imgUrl
    }

    const response = await microsoftComputerVision.tagImage(imageOptions)
    const tags = response.tags.map(tag => tag.name)

    const image = new Image({ location: pnt, tags: tags, url: imgUrl, description: desc })

    await image.save()

    const image_id = image._id
    const requriedUser = await User.findById(req.user._id)
    requriedUser.images.push(image_id)

    requriedUser.save()

    res.redirect('/')
}

const registerUser = async (req, res, next) => {
    const { username, password } = req.body
    const user = new User({ username })
    await User.register(user, password)

    req.login(user, err => {
        if (err) return next(err)

        return res.redirect('/')
    })
}

app.get('/register', registerPage)
app.post('/register', registerUser)

const loginUserForm = (req, res) => {
    res.render('login')
}

app.get('/login', loginUserForm)

app.post('/login', passport.authenticate('local', { failureFlash: true, failureRedirect: '/login' }), (req, res) => {
    console.log(req.cookies.data)
    res.redirect('/')
})

const isLoggedIn = (req, res, next) => {
    if (!req.isAuthenticated()) {
        req.flash('error', 'please login first')
        return res.redirect('/login')
    }
    next()
}

const renderProfilePage = async (req, res) => {
    const requiredUser = await User.findById(req.user._id).populate('images')
    res.render('profile', { requiredUser })
}

app.get('/', renderHomePage)
app.post('/upload', isLoggedIn, upload.single('image'), processUploadedImage)
app.get('/profile', isLoggedIn, renderProfilePage)


app.listen(3000, () => {
    console.log('Server is running on port 3000')
})
