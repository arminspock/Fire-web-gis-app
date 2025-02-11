from flask import Flask, render_template, jsonify, request
import psycopg2
from psycopg2.extras import RealDictCursor
import json

# Initialize Flask app
app = Flask(__name__)

# Database connection parameters
DB_PARAMS = {
    "dbname": "spock_webmap",
    "user": "postgres",
    "password": "5416",
    "host": "localhost"
}

def get_db_connection():
    conn = psycopg2.connect(**DB_PARAMS)
    return conn

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/get-route', methods=['GET'])
def get_route():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        grid_id = request.args.get('grid_id', type=int)
        
        # First get the centroid of the selected grid cell and nearest fire hall
        query = """
        WITH grid_centroid AS (
            SELECT ST_Centroid(geom) as start_point
            FROM grid_analysis
            WHERE grid_id = %s
        ),
        nearest_firehall AS (
            SELECT geom as end_point
            FROM fire_halls
            ORDER BY geom <-> (SELECT start_point FROM grid_centroid)
            LIMIT 1
        )
        SELECT 
            ST_AsGeoJSON(ST_MakeLine(
                (SELECT start_point FROM grid_centroid),
                (SELECT end_point FROM nearest_firehall)
            ))::json as route_geometry;
        """
        
        cur.execute(query, (grid_id,))
        result = cur.fetchone()
        
        if result and result['route_geometry']:
            return jsonify({
                "type": "Feature",
                "geometry": result['route_geometry'],
                "properties": {"grid_id": grid_id}
            })
        else:
            return jsonify({"error": "No route found"}), 404
            
    except Exception as e:
        print(f"Error in get_route: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
    finally:
        cur.close()
        conn.close()


@app.route('/api/hydrants')
def get_hydrants():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        query = """
            SELECT 
                id,
                color,
                ST_AsGeoJSON(geom)::json as geometry
            FROM water_hydrants;
        """
        cur.execute(query)
        rows = cur.fetchall()
        
        features = []
        for row in rows:
            feature = {
                "type": "Feature",
                "geometry": row["geometry"],
                "properties": {
                    "id": row["id"],
                    "color": row["color"]
                }
            }
            features.append(feature)
        
        return jsonify({
            "type": "FeatureCollection",
            "features": features
        })
    
    finally:
        cur.close()
        conn.close()

@app.route('/api/firehalls')
def get_firehalls():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        query = """
            SELECT 
                id,
                name,
                address,
                ST_AsGeoJSON(geom)::json as geometry
            FROM fire_halls;
        """
        cur.execute(query)
        rows = cur.fetchall()
        
        features = []
        for row in rows:
            feature = {
                "type": "Feature",
                "geometry": row["geometry"],
                "properties": {
                    "id": row["id"],
                    "name": row["name"],
                    "address": row["address"]
                }
            }
            features.append(feature)
        
        return jsonify({
            "type": "FeatureCollection",
            "features": features
        })
    
    finally:
        cur.close()
        conn.close()

@app.route('/api/grid')
def get_grid():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        min_score = request.args.get('min_score', type=float, default=0)
        max_score = request.args.get('max_score', type=float, default=100)
        
        query = """
            SELECT 
                grid_id,
                ST_AsGeoJSON(geom)::json as geometry,
                hydrant_count,
                final_score
            FROM grid_analysis
            WHERE final_score BETWEEN %s AND %s;
        """
        
        cur.execute(query, (min_score, max_score))
        rows = cur.fetchall()
        
        features = []
        for row in rows:
            feature = {
                "type": "Feature",
                "geometry": row["geometry"],
                "properties": {
                    "grid_id": row["grid_id"],
                    "hydrant_count": row["hydrant_count"],
                    "final_score": float(row["final_score"]) if row["final_score"] is not None else 0
                }
            }
            features.append(feature)
        
        geojson = {
            "type": "FeatureCollection",
            "features": features
        }
        
        return jsonify(geojson)
    
    except Exception as e:
        print(f"Error in get_grid: {str(e)}")
        return jsonify({"error": str(e)}), 500
    
    finally:
        cur.close()
        conn.close()

@app.route('/api/score-at-point', methods=['GET'])
def get_score_at_point():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        lat = request.args.get('lat', type=float)
        lng = request.args.get('lng', type=float)
        
        if not lat or not lng:
            return jsonify({"error": "Latitude and longitude are required"}), 400
        
        query = """
            SELECT 
                grid_id,
                hydrant_count,
                final_score
            FROM grid_analysis
            WHERE ST_Contains(geom, ST_SetSRID(ST_Point(%s, %s), 4326))
            LIMIT 1;
        """
        
        cur.execute(query, (lng, lat))
        result = cur.fetchone()
        
        if result:
            return jsonify(result)
        else:
            return jsonify({"error": "No grid cell found at this location"}), 404
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
    finally:
        cur.close()
        conn.close()

if __name__ == '__main__':
    app.run(debug=True)