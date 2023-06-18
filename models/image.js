const mongoose = require('mongoose')

const imageSchema = new mongoose.Schema({
    location: {
        coordinates: {
            type: [Number],
            required: true
        }
    },
    description: String,
    tags: [String],
    url: String
})

const Image = mongoose.model('Image', imageSchema)

module.exports = Image