var NodeHelper = require("node_helper");
var axios = require("axios");
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
        Log.info("MMM-WestBerksBinDays: socketNotificationReceived Headers JSON: " + JSON.stringify(HEADERS));

        for (var __key in json_payload_methods) {
          var __value = json_payload_methods[__key];
          __keyName = __key;

          Log.info("MMM-WestBerksBinDays: socketNotificationReceived Fetching:  " + __key + " using " + __value);
          var __pickupjson = self.getPickupMethodJSON(__value, payload.uprn)
          Log.info("MMM-WestBerksBinDays: socketNotificationReceived Post JSON: " + JSON.stringify(__pickupjson));

          axios.post("https://www.westberks.gov.uk/apiserver/ajaxlibrary", __pickupjson, { headers: HEADERS })
          .then(function(response) {
            if (response.data) {
              Log.info("MMM-WestBerksBinDays: socketNotificationReceived Response: ");
              Log.info(JSON.stringify(response.data));
              var __ret = response.data;
              
              self.schedule.push({ ServiceName: self.__keyName, nextDateText: __ret.result[self.__keyName] });
            }

            if (response.description) { Log.info(response.description); }
            if (response.error) { Log.error(response.error); }
          }).catch(function (error) {
            Log.error("MMM-WestBerksBinDays: socketNotificationReceived ");
          });

          i++;
        }

        self.getNextPickups(payload);

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

      if (element.ServiceName == this.config.refuseServiceName) {
        var refusePickup = {
          pickupDate: element.nextDateText,
          pickupType: "RefuseBin",
        };
        nextPickups.push(refusePickup);
      }
      else if (element.ServiceName == this.config.recyclingServiceName) {
        var greenPickup = {
          pickupDate: element.nextDateText,
          pickupType: "GreenBin",
        };
        nextPickups.push(greenPickup);
      }
      else if (element.ServiceName == this.config.foodWasteServiceName) {
        var foodwastePickup = {
          pickupDate: element.nextDateText,
          pickupType: "FoodBin",
        };
        nextPickups.push(foodwastePickup);
      }
    }

    multisort(nextPickups, ["pickupDate"]);

    this.sendSocketNotification(
      "MMM-WESTBERKSBINDAY-RESPONSE" + payload.instanceId, nextPickups);
  },
});
