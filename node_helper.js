var NodeHelper = require("node_helper");
var axios = require("axios");
const multisort = require("multisort");
const Log = require("logger");

// URL for the POST request
const url = "https://www.westberks.gov.uk/apiserver/ajaxlibrary"

// Set the request headers
const HEADERS = {
  "Content-Type": "application/json; charset=UTF-8",
  "User-Agent": "PostmanRuntime/7.32.2",
  "Accept": "*/*",
  "Accept-Encoding": "gzip, deflate, br",
  "Connection": "keep-alive"
}

// Define the JSON payloads
json_payload_methods = {
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
    return {
       jsonrpc: "2.0",
       id: requestId,
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
        var requestId = Math.random() * (9999999999 - 1000000000) + 1000000000;
        
        self.schedule = {};
        i=0;
        for (var __key in json_payload_methods){
          var __value = json_payload_methods[__key];

          Log.info("MM-WestBerksBinDays - Info (socketNotificationReceived Fetching): " + __key + ": " + __value);

          axios
            .post(url, self.getPickupMethodJSON(__value, payload.uprn), {headers: HEADERS})
            .then(function (response) {              
              
              Log.info("MM-WestBerksBinDays - Info (socketNotificationReceived Response): " + response);
              self.schedule.push({ServiceName: __key, nextDateText: response.data.result.json_method_result[0]});

            })
            .catch(function (error) {
              // TODO: alert on errors
              if (error.response) {
                Log.error("! MM-WestBerksBinDays - Error (socketNotificationReceived): " + error.Response);
              }
              else {
                Log.error("! MM-WestBerksBinDays - Error: (socketNotificationReceived)");
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

    this.schedule.forEach((element) => {
      if (element.ServiceName == payload.refuseServiceName) {
        var refusePickup = {
          pickupDate: element.nextDateText,
          pickupType: "RefuseBin",
        };
        nextPickups.push(refusePickup);
      }
      if (element.ServiceName == payload.recyclingServiceName) {
        var greenPickup = {
          pickupDate: element.nextDateText,
          pickupType: "GreenBin",
        };
        nextPickups.push(greenPickup);
      }
      if (element.ServiceName == payload.foodWasteServiceName) {
        var foodwastePickup = {
          pickupDate: element.nextDateText,
          pickupType: "FoodBin",
        };
        nextPickups.push(foodwastePickup);
      }
    });

    multisort(nextPickups, ["pickupDate"]);

    this.sendSocketNotification(
      "MMM-WESTBERKSBINDAY-RESPONSE" + payload.instanceId, nextPickups);
  },
});
