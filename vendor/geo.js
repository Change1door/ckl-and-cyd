/* ============================================================
   geo.js · 极简版 d3-geo 替代
   - geoOrthographic：把 (lng, lat) 投到球面 2D 坐标
   - geoPath：把 GeoJSON Feature 渲染成 SVG path
   - geoGraticule：生成经纬线 GeoJSON
   不依赖 d3-array / d3-geo，UMD 浏览器直接加载即可
   ============================================================ */

(function (root) {
  'use strict';

  const PI = Math.PI;
  const DEG = PI / 180;

  /* ---------- Orthographic 投影 ----------
     等距方位投影：从无限远看地球
     rotate: [λ, φ] —— 经度 λ / 纬度 φ 旋转到屏幕中心 */
  function orthographic(rotate) {
    rotate = rotate || [0, 0];
    const lambda0 = rotate[0] * DEG;
    const phi0 = rotate[1] * DEG;

    return function (lngLat) {
      const lambda = lngLat[0] * DEG;
      const phi = lngLat[1] * DEG;
      const cosC = Math.sin(phi0) * Math.sin(phi) +
                   Math.cos(phi0) * Math.cos(phi) * Math.cos(lambda - lambda0);
      // cosC < 0 → 在地球背面
      if (cosC < 0) return null;
      const x = Math.cos(phi) * Math.sin(lambda - lambda0);
      const y = Math.cos(phi0) * Math.sin(phi) - Math.sin(phi0) * Math.cos(phi) * Math.cos(lambda - lambda0);
      return [x, y];
    };
  }

  /* ---------- GeoJSON path 生成 ----------
     把 Feature 的多边形 / 多边形集合转成 SVG d 字符串 */
  function makePath(project, scale, translate) {
    const sx = scale, sy = -scale; // y 反转：lat 越北 → SVG y 越小
    const tx = translate[0], ty = translate[1];
    const R = Math.abs(scale);      // 球面半径

    function point(coords) {
      const p = project(coords);
      if (!p) return null;
      return [tx + p[0] * sx, ty + p[1] * sy];
    }

    // 计算点到球心的距离，判断是否在球内
    function distFromCenter(p) {
      return Math.sqrt((p[0] - tx) ** 2 + (p[1] - ty) ** 2);
    }

    function ring(ring) {
      // 先把所有点算出来，然后根据是否在球内判断要不要画
      const points = ring.map((c) => point(c));
      let d = '';
      let started = false;
      let prevInside = false;
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const inside = p && distFromCenter(p) <= R * 1.0;  // 球内（不放大）
        if (p) {
          if (!started || !prevInside) {
            // 新段开始
            d += (started ? 'M' : 'M') + p[0].toFixed(2) + ',' + p[1].toFixed(2) + 'L';
            started = true;
          } else {
            d += p[0].toFixed(2) + ',' + p[1].toFixed(2) + 'L';
          }
          prevInside = inside;
        } else {
          prevInside = false;
        }
      }
      if (d.endsWith('L')) d = d.slice(0, -1) + 'Z';
      return d;
    }

    function polygon(poly) {
      let d = '';
      poly.forEach((r) => { d += ring(r); });
      return d;
    }

    function geometry(geom) {
      if (geom.type === 'Polygon') return polygon(geom.coordinates);
      if (geom.type === 'MultiPolygon') {
        let d = '';
        geom.coordinates.forEach((p) => { d += polygon(p); });
        return d;
      }
      return '';
    }

    return function (feature) {
      if (!feature) return '';
      if (feature.type === 'FeatureCollection') {
        let d = '';
        feature.features.forEach((f) => { d += geometry(f.geometry); });
        return d;
      }
      if (feature.type === 'Feature') return geometry(feature.geometry);
      // 原始 geometry
      if (feature.type) return geometry(feature);
      return '';
    };
  }

  /* ---------- Graticule 经纬线 ----------
     生成等间距经纬度线（GeoJSON LineString 集合） */
  function graticule(step) {
    step = step || [20, 20];
    const dx = step[0], dy = step[1];
    const coords = [];
    // 经线（meridians）
    for (let lon = -180; lon <= 180; lon += dx) {
      const line = [];
      for (let lat = -90; lat <= 90; lat += 2) line.push([lon, lat]);
      coords.push(line);
    }
    // 纬线（parallels）
    for (let lat = -80; lat <= 80; lat += dy) {
      const line = [];
      for (let lon = -180; lon <= 180; lon += 2) line.push([lon, lat]);
      coords.push(line);
    }
    return { type: 'FeatureCollection', features: coords.map((c) => ({
      type: 'Feature', geometry: { type: 'LineString', coordinates: c }, properties: {}
    })) };
  }

  /* ---------- Equirectangular 投影（平面世界地图）----------
     最简单的圆柱投影：lng → x（线性），lat → y（线性）
     viewBox 是 1000×500，中心点 500,250，范围 ±180 经度 / ±90 纬度 */
  function equirectangular(width, height) {
    const W = width, H = height;
    return function (lngLat) {
      const lng = lngLat[0];
      const lat = lngLat[1];
      // 投影公式：x = (lng + 180) / 360 * W，y = (90 - lat) / 180 * H
      const x = ((lng + 180) / 360) * W;
      const y = ((90 - lat) / 180) * H;
      return [x, y];
    };
  }

  /* ---------- 经纬线（平面地图专用） ---------- */
  function graticuleFlat(step) {
    step = step || [20, 20];
    const dx = step[0], dy = step[1];
    const coords = [];
    // 经线（meridians）：竖线
    for (let lng = -180; lng <= 180; lng += dx) {
      coords.push([[lng, -85], [lng, 85]]);
    }
    // 纬线（parallels）：横线
    for (let lat = -80; lat <= 80; lat += dy) {
      coords.push([[-180, lat], [180, lat]]);
    }
    return { type: 'FeatureCollection', features: coords.map((c) => ({
      type: 'Feature', geometry: { type: 'LineString', coordinates: c }, properties: {}
    })) };
  }

  /* ---------- GeoJSON path 生成（平面 / 球面通用）----------
     接受任意 project 函数（返回像素坐标或 null） */
  function makePathGeneric(project) {
    function point(coords) {
      const p = project(coords);
      if (!p) return null;
      return p;
    }

    function ring(ring) {
      let d = '';
      let started = false;
      let prevInside = false;
      for (let i = 0; i < ring.length; i++) {
        const p = point(ring[i]);
        if (p) {
          if (!started || !prevInside) {
            d += (started ? 'M' : 'M') + p[0].toFixed(2) + ',' + p[1].toFixed(2) + 'L';
            started = true;
          } else {
            d += p[0].toFixed(2) + ',' + p[1].toFixed(2) + 'L';
          }
          prevInside = true;
        } else {
          prevInside = false;
        }
      }
      if (d.endsWith('L')) d = d.slice(0, -1) + 'Z';
      return d;
    }

    function polygon(poly) {
      let d = '';
      poly.forEach((r) => { d += ring(r); });
      return d;
    }

    function geometry(geom) {
      if (geom.type === 'Polygon') return polygon(geom.coordinates);
      if (geom.type === 'MultiPolygon') {
        let d = '';
        geom.coordinates.forEach((p) => { d += polygon(p); });
        return d;
      }
      return '';
    }

    return function (feature) {
      if (!feature) return '';
      if (feature.type === 'FeatureCollection') {
        let d = '';
        feature.features.forEach((f) => { d += geometry(f.geometry); });
        return d;
      }
      if (feature.type === 'Feature') return geometry(feature.geometry);
      if (feature.type) return geometry(feature);
      return '';
    };
  }

  /* ---------- 暴露到 window.geo ---------- */
  root.geo = {
    orthographic: orthographic,
    geoOrthographic: orthographic,
    path: makePath,           // 球面用（接受 scale, translate）
    geoPath: makePath,
    graticule: graticule,
    geoGraticule: graticule,
    equirectangular: equirectangular,
    graticuleFlat: graticuleFlat,
    pathGeneric: makePathGeneric,   // 平面用（只需要 project 函数）
  };
})(typeof window !== 'undefined' ? window : globalThis);