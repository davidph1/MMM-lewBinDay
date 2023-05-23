Module.register('MMM-WestBerksBinDay', {

  // Default values
  defaults: {
    uprn: "",
    dateFormat: "dddd D MMMM",
    refuseServiceName: "nextRubbishDateText",
    recyclingServiceName: "nextRecyclingDateText",
    foodWasteServiceName: "nextFoodWasteDateText"
  },

  // Define stylesheet
  getStyles: function () {
    return ["MMM-WestBerksBinDay.css"];
  },

  // Define required scripts.
  getScripts: function () {
    return []; //["moment.js"];
  },

  capFirst: function (string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  },

  start: function () {
    Log.info('Starting module: ' + this.name);
    this.sendSocketNotification('MMM-WESTBERKSBINDAY-CONFIG', this.config);
    this.nextPickups = [];
    this.getPickups();
    this.timer = null;
  },

  // Get data from API passing the uprn
  getPickups: function () {
    clearTimeout(this.timer);
    this.timer = null;
    this.sendSocketNotification("MMM-WESTBERKSBINDAY-GET", {
      instanceId: this.identifier,
      uprn: this.config.uprn,
      refuseServiceName: this.config.refuseServiceName,
      recyclingServiceName: this.config.recyclingServiceName,
      foodWasteServiceName: this.config.foodWasteServiceName
    });

    // Set check times
    var self = this;
    this.timer = setTimeout(function () {
      self.getPickups();
    }, 60 * 60 * 1000); // update once an hour
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification == "MMM-WESTBERKSBINDAY-RESPONSE" + this.identifier && payload.length > 0) {
      this.nextPickups = payload;
      this.updateDom(1000);
    }
  },

  // Create Binday Icons from binday_icons.svg
  svgIconFactory: function (color) {
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttributeNS(null, "class", "binday-icon");
    //Switch for Legacy files
    switch (color) {
      case 'GreenBin':
        svg.setAttributeNS(null, "style", "fill: #00A651");
        break;
      case 'RefuseBin':
        svg.setAttributeNS(null, "style", "fill: #787878");
        break;
      case 'PaperBin':
          svg.setAttributeNS(null, "style", "fill: #0059ff");
        break;      
      case 'FoodBin':
          svg.setAttributeNS(null, "style", "fill: #38761d");
        break;
      default:
        svg.setAttributeNS(null, "style", "fill: " + color);
        break;
    }
    var use = document.createElementNS('http://www.w3.org/2000/svg', "use");
    use.setAttributeNS("http://www.w3.org/1999/xlink", "href", this.file("binday_icons.svg#bin"));
    svg.appendChild(use);
    return (svg);
  },

  getDom: function () {
    var wrapper = document.createElement("div");

    if (this.nextPickups.length == 0) {
      wrapper.innerHTML = this.translate("LOADING");
      wrapper.className = "dimmed light small";
      return wrapper;
    }

    for (i = 0; i < this.nextPickups.length; i++) {

      var pickup = this.nextPickups[i];

      var pickupContainer = document.createElement("div");
      pickupContainer.classList.add("binday-container");

      var dateContainer = document.createElement("span");
      dateContainer.classList.add("binday-date");

      moment.locale();
      var today = moment().startOf("day");
      var pickUpDate = moment(pickup.pickupDate);
      if (today.isSame(pickUpDate)) {
        dateContainer.innerHTML = "Today";
      } else if (moment(today).add(1, "days").isSame(pickUpDate)) {
        dateContainer.innerHTML = "Tomorrow";
      } else if (moment(today).add(7, "days").isAfter(pickUpDate)) {
        dateContainer.innerHTML = this.capFirst(pickUpDate.format("dddd"));
      } else {
        dateContainer.innerHTML = this.capFirst(pickUpDate.format(this.config.dateFormat));
      }

      pickupContainer.appendChild(dateContainer);

      var iconContainer = document.createElement("span");
      iconContainer.classList.add("binday-icon-container");
      iconContainer.appendChild(this.svgIconFactory(pickup.pickupType));

      pickupContainer.appendChild(iconContainer);
      wrapper.appendChild(pickupContainer);

    };

    return wrapper;
  }

});
