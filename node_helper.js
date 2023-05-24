var NodeHelper = require("node_helper");
var axios = require("axios");
var moment = require("moment");
const multisort = require("multisort");

const Log = require("logger");

// URL for the POST request
var URL = "https://www.westberks.gov.uk/apiserver/ajaxlibrary";

// Set the request headers
var HEADERS = {
  'Content-Type': 'application/json; charset=UTF-8',
  'User-Agent': 'PostmanRuntime/7.32.2',
  'Accept': '*/*',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive'
};

// Define the JSON payloads
var json_payload_methods = {
  nextRubbishDateText: "goss.echo.westberks.forms.getNextRubbishCollectionDate",
  nextRecyclingDateText: "goss.echo.westberks.forms.getNextRecyclingCollectionDate",
  nextFoodWasteDateText: "goss.echo.westberks.forms.getNextFoodWasteCollectionDate"
};

var __keyName = "";

module.exports = NodeHelper.create({
  start: function () {
    console.log("Starting node_helper for module: " + this.name);
    this.schedule = null;
  },

  getPickupMethodJSON: function (_method, _uprn) {
    //var __requestId = Math.random() * (9999999999 - 1000000000) + 1000000000;
    return {
      jsonrpc: "2.0",
      id: "1",
      //        id: __requestId,
      method: _method,
      params: {
        uprn: _uprn,
      }
    }
  },

  convertStringToDate: function (dateString) {
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
        Log.info("MMM-WestBerksBinDays: socketNotificationReceived URL:       " + URL);
        Log.info("MMM-WestBerksBinDays: socketNotificationReceived UPRN:      " + payload.uprn);
        //Log.info("MMM-WestBerksBinDays: socketNotificationReceived Headers JSON: " + JSON.stringify(HEADERS));

        for(var __key in json_payload_methods) {
          var __value = json_payload_methods[__key];

          //Log.info("MMM-WestBerksBinDays: socketNotificationReceived Fetching:  " + __key + " using " + __value);
          var __pickupjson = self.getPickupMethodJSON(__value, payload.uprn)
          //Log.info("MMM-WestBerksBinDays: socketNotificationReceived Post JSON: " + JSON.stringify(__pickupjson));

          axios.post("https://www.westberks.gov.uk/apiserver/ajaxlibrary", __pickupjson, { headers: HEADERS })
          .then(function(response) {

            if (response.data) {
              //Log.info("MMM-WestBerksBinDays: socketNotificationReceived Response: ");
              //Log.info(JSON.stringify(response.data));
        
              for(var reskey in response.data.result)
              {

                if (reskey == payload.refuseServiceName ||
                    reskey ==  payload.recyclingServiceName ||
                    reskey ==  payload.foodWasteServiceName) 
                {
                  //Log.info(`result key: ${reskey}`);
                  //Log.info(`result value: ${response.data.result[reskey]}`);

                  try {
                    const dateString = (response.data.result[reskey]);
                    const dateObject = convertStringToDate(dateString);
                    Log.info(dateObject);
                  } catch (error) {
                    Log.error('Error:', error.message);
                  }

                  self.schedule.push({ServiceName: reskey, nextDateText: dateObject});
                }
              }
              self.getNextPickups(payload);

            }

            if (response.description) { Log.info(response.description); }
            if (response.error) { Log.error(response.error); }
          }).catch(function (error) {
            Log.error("MMM-WestBerksBinDays: socketNotificationReceived ");
          });

          i++;
        }


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

      if (element.ServiceName == payload.refuseServiceName) {
        var refusePickup = {
          pickupDate: moment(element.nextDateText),
          pickupType: "RefuseBin",
        };
        nextPickups.push(refusePickup);
      }
      else if (element.ServiceName == payload.recyclingServiceName) {
        var greenPickup = {
          pickupDate: moment(element.nextDateText),
          pickupType: "GreenBin",
        };
        nextPickups.push(greenPickup);
      }
      else if (element.ServiceName == payload.foodWasteServiceName) {
        var foodwastePickup = {
          pickupDate: moment(element.nextDateText),
          pickupType: "FoodBin",
        };        
        nextPickups.push(foodwastePickup);
      }
    }
    //Log.info("nextPickups length (pre sort): "+ nextPickups.length);
    multisort(nextPickups, ["pickupDate"]);
    //Log.info("nextPickups length: "+ nextPickups.length);
    
    this.sendSocketNotification("MMM-WESTBERKSBINDAY-RESPONSE" + payload.instanceId, nextPickups);
  },
});
