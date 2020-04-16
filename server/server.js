const express = require('express');
const bodyParser = require('body-parser');
const Sentiment = require('sentiment');
const colormap = require('colormap');
const cors = require('cors');
const sentiment = new Sentiment();
const app = express();

app.use(bodyParser.json());
app.use(cors());

app.get('/sentiment', (req, res) => {
    let phrase = req.query.phrase;
    let { score } = sentiment.analyze(phrase);
    res.send({
        insanity: -1 * score / 5
    })
});

app.get('/colormap', (req, res) => {
    res.send({
        map: colormap({
            colormap: 'autumn',
            nshades: 5,
            format: 'hex',
            alpha: 1
        }).reverse()
    })
})

app.listen(8000, () => {
    console.log('App started at 8000');
})