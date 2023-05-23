var NodeHelper = require("node_helper");
var axios = require("axios");
const multisort = require("multisort");
const Log = require("logger");

// URL for the POST request
const URL = "https://www.westberks.gov.uk/apiserver/ajaxlibrary"

// Set the request headers
const HEADERS = {
  "Content-Type": "application/json; charset=UTF-8",
  "User-Agent": "PostmanRuntime/7.32.2",
  "Accept": "*/*",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive"  
}

// Define the JSON payloads
const json_payload_methods = {
  nextRubbishDateText:  "goss.echo.westberks.forms.getNextRubbishCollectionDate",
  nextRecyclingDateText:"goss.echo.westberks.forms.getNextRecyclingCollectionDate",
  nextFoodWasteDateText:"goss.echo.westberks.forms.getNextFoodWasteCollectionDate",
}

module.exports = NodeHelper.create({
  start: function () {
    console.log("Starting node_helper for module: " + this.name);
    this.schedule = null;
  },

  getPickupMethodJSON: function (_method, _uprn) {
    var __requestId = Math.random() * (9999999999 - 1000000000) + 1000000000;
    return {
        jsonrpc: "2.0",
        id: __requestId,
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
        i=0;
        for (var __key in json_payload_methods){
          var __value = json_payload_methods[__key];

          Log.info("MM-WestBerksBinDays - socketNotificationReceived Fetching " + __key + " from " + __value);
          Log.info("MM-WestBerksBinDays - socketNotificationReceived URL " + URL);
          Log.info("MM-WestBerksBinDays - socketNotificationReceived UPRN " + payload.uprn);
          Log.info("MM-WestBerksBinDays - socketNotificationReceived UPRN " + payload.uprn);

          axios
            .post(this.URL, self.getPickupMethodJSON(__value, payload.uprn), {headers: HEADERS, timeout: 8000})
            .then(function (response) {              
              
              Log.info("MM-WestBerksBinDays - socketNotificationReceived Response: ");
              Log.info(response.description);
              Log.info(response.error);
              Log.info(response.data);
              self.schedule.push({ServiceName: __key, nextDateText: response.data.result.json_method_result});

            })
            .catch(function (error) {
              // TODO: alert on errors
              if (error.response) {
                Log.error("! MM-WestBerksBinDays - socketNotificationReceived: " + error.Response);
              }
              else {
                Log.error("! MM-WestBerksBinDays - socketNotificationReceived");
              }
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

    for (let i = 0; i < this.schedule.length; i++) {
      element=this.schedule[i];

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
