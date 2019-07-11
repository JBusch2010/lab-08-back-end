'use strict';

// First initialize ENV configs
require('dotenv').config();

// NPM Packages
const express = require('express');
const cors = require('cors');
const superagent = require('superagent');
const pg = require('pg');

const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
// client.on('error', error => console.error(error));

// Global Variables
const PORT = process.env.PORT;

const app = express(); // Instantiate Express app
app.use(cors()); // Cross Origin support

// Server Express static files from public directory
app.use(express.static('public'));

// GET - user location input, display on map
// ---------------------------------------------
app.get('/location', returnLocation);

// GET - daily weather details from location
// ---------------------------------------------
app.get('/weather', returnWeather);

// GET - daily Event details from location
// ---------------------------------------------
app.get('/events', returnEvents);

// 404 - catch all paths that are not defined
// ---------------------------------------------
app.use('*', (request, response) => {
  response.status(404).send('Sorry, page not found');
});

// Location Constructor
function Location(locationName, result) {
  this.search_query = locationName;
  this.formatted_query = result.body.results[0].formatted_address;
  this.latitude = result.body.results[0].geometry.location.lat;
  this.longitude = result.body.results[0].geometry.location.lng;
}

// Location - get Geo JSON, create object via constructor, return object
// -----------------------------------------------------------------------

function returnLocation(request, response) {
  const locationName = request.query.data;
  const table = 'locations';
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${locationName}&key=${process.env.GEOCODE_API_KEY}`

  client.query(`SELECT * FROM locations WHERE search_query=$1`, [locationName])
    .then (sqlResult => {
      if (sqlResult.rowCount === 0) {
        superagent.get(url)
          .then(result => {
            let location = new Location (locationName, result);
            client.query(`INSERT INTO locations (
              search_query,
              formatted_query,
              latitude,
              longitude
              ) VALUES ($1, $2, $3, $4)`, [location.search_query, location.formatted_query, location.latitude, location.longitude]
            )
            console.log('sending from googles');
            response.send(location);

          }).catch (err => {
            // console.error(err);
            response.status(500).send('Status 500: So sorry I broke');
          })
      } else {
        console.log ('sending from db');
        response.send(sqlResult.rows[0]);
      }
    });
}
// Weather - get Darksky JSON, create object via constructor, return object
// -------------------------------------------------------------------------
function dbVerify (url, sqlString, table, locationName) {
  client.query(`SELECT * FROM ${table} WHERE search_query=S1`, [locationName])
    .then(sqlResult => {
      if (sqlResult.rowCount === 0) {
        superagent.get(url)
          .then(return false)
          } else {response.send(sqlResult.rows[0])})
      }
    })
}

// Weather - get Darksky JSON, create object via constructor, return object
// -------------------------------------------------------------------------


//Weather Constructor
function Weather(forecast, time) {
  this.forecast = forecast;
  this.time = time;
}

// Weather - get Darksky JSON, create object via constructor, return object
// -------------------------------------------------------------------------
function returnWeather (request, response) {
  const lat = request.query.data.latitude;
  const lng = request.query.data.longitude;
  const url = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${lat},${lng}`;
  superagent
    .get(url)
    .then(result => {
      const weather = result.body.daily.data.map(obj => {
        let forecast = obj.summary;
        let time = new Date(obj.time * 1000).toDateString();
        return new Weather(forecast, time);
      })
      response.status(200).send(weather);

    })
    .catch(err => {
      // console.error(err);
      response.status(500).send('Sorry, something went wrong.');
    })
}

//Event Constructor
function Event(link, name, event_date, summary) {
  this.link = link;
  this.name = name;
  this.event_date = event_date;
  this.summary = summary;
}

// Constructor - get EventBrite JSON, create object via constructor, return object
// -------------------------------------------------------------------------
function returnEvents (request, response) {
  const lat = request.query.data.latitude;
  const lng = request.query.data.longitude;
  const url = `https://www.eventbriteapi.com/v3/events/search/?location.latitude=${lat}&location.longitude=${lng}&token=${process.env.EVENTBRITE_API_KEY}`;
  superagent
    .get(url)
    .then(result => {
      const events = result.body.events.map(obj => {
        const link = obj.url;
        const name = obj.name.text;
        const date = new Date(obj.start.local).toDateString();
        const summary = obj.description.text;
        return new Event(link, name, date, summary);
      })
      response.status(200).send(events);

    })
    .catch(err => {
      // console.error(err);
      response.status(500).send('Sorry, something went wrong.');
    })
}


// Start the server!!!
// --------------------
app.listen(PORT, () => {
  console.log(`Listening on PORT:${PORT}`);
});

