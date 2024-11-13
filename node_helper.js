var NodeHelper = require("node_helper");
var axios = require("axios");
var moment = require("moment");
const multisort = require("multisort");

const Log = require("logger");

// URL for the POST request
var URL = "https://lewisham.gov.uk/api/roundsinformation?item=23423835-d2a6-41b1-9637-29e5e8cc2df7&uprn=";

// Set the request headers
var HEADERS = {
  'Content-Type': 'application/json; charset=UTF-8',
  'User-Agent': 'PostmanRuntime/7.32.2',
  'Accept': '*/*',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive'
};

var __keyName = "";

function convertStringToDate(dateString) {
  // Define the month names and their respective indexes
  const monthNames = {
    January: 0,
    February: 1,
    March: 2,
    April: 3,
    May: 4,
    June: 5,
    July: 6,
    August: 7,
    September: 8,
    October: 9,
    November: 10,
    December: 11
  };

  // Split the input string by space
  const parts = dateString.split(' ');

  // Ensure the input string has three parts
  if (parts.length !== 3) {
    throw new Error('Invalid date string format. Expected format: "Weekday Day Month".');
  }

  // Extract the day, month, and year values
  const day = parseInt(parts[1]);
  const month = monthNames[parts[2]];

  // Ensure day and month are valid numbers
  if (isNaN(day) || isNaN(month)) {
    throw new Error('Invalid day or month value.');
  }

  // Ensure day is within a valid range
  if (day < 1 || day > 31) {
    throw new Error('Invalid day value. Day must be between 1 and 31.');
  }

  // Ensure month is within a valid range
  if (month < 0 || month > 11) {
    throw new Error('Invalid month value. Month must be between 0 and 11.');
  }

  // Create a new Date object using the extracted values
  const year = new Date().getFullYear(); // Assumes current year
  const dateObject = new Date(year, month, day);

  return dateObject;
}


module.exports = NodeHelper.create({
  start: function () {
    console.log("Starting node_helper for module: " + this.name);
    this.schedule = null;
  },

  socketNotificationReceived: function (notification, payload) {
    var self = this;
    if (notification == "MMM-WESTBERKSBINDAY-CONFIG") {
      this.config = payload;
    } else if (notification == "MMM-WESTBERKSBINDAY-GET") {
      if (this.schedule == null) {
        // generate a random Id, required for the request post data♦

        self.schedule = [];
        var i = 0;
        Log.info(" URL: " + URL);
        Log.info(" UPRN: " + payload.uprn);
        axios.post("https://lewisham.gov.uk/api/roundsinformation?item=23423835-d2a6-41b1-9637-29e5e8cc2df7&uprn=" + payload.uprn, { headers: HEADERS })
         .then(function (response) {
            if (response.data) {
                Log.info("MMM-WestBerksBinDays: socketNotificationReceived Response: ");
                Log.info(JSON.stringify(response)); //response.data

                for (var reskey in response.data.result) {

                  if (reskey == payload.refuseServiceName ||
                    reskey == payload.recyclingServiceName ||
                    reskey == payload.foodWasteServiceName) {
                    Log.info(`result key: ${reskey}`);
                    Log.info(`result value: ${response.data.result[reskey]}`);

                    self.schedule.push({ ServiceName: reskey, nextDateText: response.data.result[reskey] });
                  }
                }
                self.getNextPickups(payload);

              }

              if (response.description) { Log.info(response.description); }
              if (response.error) { Log.error(response.error); }
            }).catch(function (error) {
              Log.error("MMM-WestBerksBinDays: socketNotificationReceived ");
            });
      } else {
        this.getNextPickups(payload);
      }
    }
  },

  getNextPickups: function (payload) {
    var nextPickups = [];

    Log.info("MMM-WestBerksBinDays: getNextPickups Schedule Length=" + this.schedule.length);
    for (let i = 0; i < this.schedule.length; i++) {
      element = this.schedule[i];
      Log.info(`MMM-WestBerksBinDays: getNextPickups element.ServiceName = ${element.ServiceName}`);
      Log.info(`MMM-WestBerksBinDays: getNextPickups element.nextDateText = ${element.nextDateText}`);

      try {
        if (element.ServiceName == payload.refuseServiceName) {
          var refusePickup = {
            pickupDate: convertStringToDate(element.nextDateText),
            pickupType: "Refuse Bin",
          };
          nextPickups.push(refusePickup);
        }
        else if (element.ServiceName == payload.recyclingServiceName) {
          var greenPickup = {
            pickupDate: convertStringToDate(element.nextDateText),
            pickupType: "Green Bin",
          };
          nextPickups.push(greenPickup);
        }
        else if (element.ServiceName == payload.foodWasteServiceName) {
          var foodwastePickup = {
            pickupDate: convertStringToDate(element.nextDateText),
            pickupType: "Food Bin",
          };
          nextPickups.push(foodwastePickup);
        }
      } catch (error) {
        Log.error('Error:', error.message);
      }

    }
    multisort(nextPickups, ["pickupDate"]);
    this.sendSocketNotification("MMM-WESTBERKSBINDAY-RESPONSE" + payload.instanceId, nextPickups);
  },
});
