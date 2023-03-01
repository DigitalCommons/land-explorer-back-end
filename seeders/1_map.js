'use strict';

const { faker } = require('@faker-js/faker');
const enums = require('../lib/enums');
const bcrypt = require('bcrypt');

module.exports = {

  up: (queryInterface, Sequelize) => {
    return queryInterface.bulkInsert('map', [{
      name: "test map",
      data: `{"map":{"zoom":[8.04003671885966],"lngLat":[-2.4903228401420847,54.06480811062397],"searchMarker":null,"marker":[-0.2416815,51.5285582],"gettingLocation":false,"currentLocation":null,"movingMethod":"flyTo","name":"A New Map"},"drawings":{"polygons":[{"data":{"type":"Feature","geometry":{"coordinates":[[[-2.8921928171605202,54.34530735189884],[-2.7104904128853775,53.99860576046865],[-2.457465569558366,54.310668998024425],[-2.7665294721526266,54.434243383843636],[-2.8921928171605202,54.34530735189884]]],"type":"Polygon"},"properties":{"id":"2f1fbaf5ac5b610d7a93a117275a6cbb"},"id":"2f1fbaf5ac5b610d7a93a117275a6cbb"},"name":"My Shape","id":"2f1fbaf5ac5b610d7a93a117275a6cbb","center":[-2.674829193359443,54.21642457215614],"type":"Polygon","length":115.82442892808945,"area":679114869.2276015},{"data":{"type":"Feature","geometry":{"coordinates":[[[-2.4302198046597994,54.38844042060427],[-2.402182007478075,54.16181232994964],[-2.0230041791395195,54.174305422973674],[-2.055047375880207,54.3348167343882],[-2.2579876220593746,54.438115679745664],[-2.2579876220593746,54.2554184623973],[-2.3861604090955097,54.397759123507484],[-2.4302198046597994,54.38844042060427]]],"type":"Polygon"},"properties":{"id":"cdd624662929b20d6cc48debae4abe9b"},"id":"cdd624662929b20d6cc48debae4abe9b"},"name":"Polygon 2","id":"cdd624662929b20d6cc48debae4abe9b","center":[-2.2266119918996594,54.29996400484765],"type":"Polygon","length":126.63606370703468,"area":537794660.3667401}],"activePolygon":"2f1fbaf5ac5b610d7a93a117275a6cbb","polygonCount":3,"lineCount":1,"loadingDrawings":false},"markers":{"searchMarker":[-0.2416815,51.5285582],"currentMarker":null,"id":1,"markers":[]},"mapLayers":{"activeLayers":[]},"version":"1.00","name":"A New Map"}`,
      deleted: 0,
      created_date: new Date(),
      last_modified: new Date()
    }]);
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.bulkDelete('map', null, {});
  }

};
