function initDataMap(dataUrl) {
  var map = new L.Map('data-map', {
    zoomControl:true,
    maxBounds: [[-60, -185], [85, 185]]
  });

  map._layersMaxZoom=6;
  map._layersMinZoom=1.5;
  // map.dragging.disable();
  map.touchZoom.disable();
  map.doubleClickZoom.disable();
  map.scrollWheelZoom.disable();
  map.boxZoom.disable();
  map.keyboard.disable();

  // Create control for dropdown selector

  var selector = L.control({
    position: 'topright'
  });

  // Add content to the control
  selector.onAdd = function(map) {

    //create div container
    var div = L.DomUtil.create('div', 'hazard_select');

    //create select element within container (with id, so it can be referred to later
    div.innerHTML = '<select id="hazard_select" class="form-control input-sm"><option value ="FL">River flood</option><option value ="EQ">Earthquake</option><option value ="DR">Water scarcity</option><option value ="CY">Cyclone</option><option value ="CF">Coastal flood</option><option value ="TS">Tsunami</option><option value ="VO">Volcano</option><option value ="LS">Landslide</option></select>';
    return div;
  };

  // Add the selector to the map
  selector.addTo(map);

  // Get json through jquery

  $.getJSON(dataUrl, function(data) {
    var geojson = L.geoJson(data);

    // Add event listeners
    var select = L.DomUtil.get("hazard_select");
    L.DomEvent.addListener(select, 'click', function(e) {
      L.DomEvent.stopPropagation(e);
    });

    L.DomEvent.addListener(select, 'change', changeHandler);

    // Change style based on dropdown

    function changeHandler(e) {
      setHazard(this.value);
    }

    function setHazard(hazard) {
      geojson.setStyle(function(feature) {
        return getStyle(feature, hazard);
      });

      geojson.eachLayer(function(layer) {
        bindPopup(layer, hazard);
      });
    }

    setHazard('FL');

    map.fitBounds(geojson.getBounds());
    geojson.addTo(map);
  });

  var colors = {
    'LOC': ['#2b5fa3', '#2175b5'],
    'GLO': ['#6baed6', '#bdd7e7']
  };

  // Create the Legend control

  var legend = L.control({position: 'bottomleft'});

  legend.onAdd = function (map) {

    // Add the content to the Legend Container

    var div = L.DomUtil.create('ul', 'legend');
    div.innerHTML += '<li><i style="background: ' + colors.GLO[1] + '"></i><span>Global</span></li>';
    div.innerHTML += '<li><i style="background: ' + colors.LOC[1] + '"></i><span>Local</span></li>';
    div.innerHTML += '<li><i style="background: #FFFFFF"></i><span>No Data</span></li>';

    return div;
  };

  // Add legend to map

  legend.addTo(map);

  function getStyle(feature, hazard) {
    var p = feature.properties;
    var color = '#afafaf';
    var fillColor = '#ffffff';

    var hazardsets = p.hazard_categories[hazard];
    if (hazardsets && hazardsets.length > 0) {
      // There may be local and global data taken into account, but
      // we consider that the first one is the one we want to display on map
      var local = hazardsets[0].local;
      fillColor = local ? colors.LOC[0] : colors.GLO[0];
      color = local ? colors.LOC[1] : colors.GLO[1];
    }

    return {
      weight: 1,
      color: color,
      fillColor: fillColor,
      lineJoin: 'bevel',
      opacity: 1,
      fillOpacity: 1
    };
  }

  function bindPopup(layer, hazard) {
    var p = layer.feature.properties;

    var hazardsets = p.hazard_categories[hazard];
    var locals = [];
    var globals = [];
    if (hazardsets && hazardsets.length > 0) {
      hazardsets.forEach(function(set) {
        if (set.local) {
          locals.push(set.id);
        } else {
          globals.push(set.id);
        }
      });
    }
    var info = [
      '<b>Country: </b>', p.name
    ].join('');
    if (locals.length) {
      info += '<br><b>Local: </b>' + locals.join(', ');
    }
    if (globals.length) {
      info += '<br><b>Global: </b>' + globals.join(', ');
    }
    layer.bindPopup(info);
  }

}
