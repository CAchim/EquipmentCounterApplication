import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";


interface Plant {
  entry_id: number;
  plant_name: string;
}

const ManagePlantsPage = () => {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();

  const [newPlantName, setNewPlantName] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadPlants = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch("/api/plants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "getPlants" }),
      });

      const data = await res.json();

      if (data.status !== 200) {
        setError(data.message || "Failed to load plants");
      } else {
        setPlants(data.data || []);
      }
    } catch (err: any) {
      console.error("Error loading plants:", err);
      setError("Error loading plants");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlants();
  }, []);

  const handleAddPlant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlantName.trim()) return;

    try {
      setAdding(true);
      setError(null);

      const res = await fetch("/api/plants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "addPlant", plant_name: newPlantName.trim() }),
      });

      const data = await res.json();

      if (data.status !== 200) {
        alert(data.message || "Failed to add plant");
      } else {
        setNewPlantName("");
        await loadPlants();
      }
    } catch (err: any) {
      console.error("Error adding plant:", err);
      alert("Error adding plant");
    } finally {
      setAdding(false);
    }
  };

  const handleDeletePlant = async (plant: Plant) => {
    if (!confirm(`Are you sure you want to delete "${plant.plant_name}"?`)) return;

    try {
      setDeletingId(plant.entry_id);

      const res = await fetch("/api/plants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "removePlant", plant_id: plant.entry_id }),
      });

      const data = await res.json();

      if (data.status !== 200) {
        alert(data.message || "Failed to remove plant");
      } else {
        setPlants(prev => prev.filter(p => p.entry_id !== plant.entry_id));
      }
    } catch (err) {
      console.error("Error removing plant:", err);
      alert("Error removing plant");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="container manage-plants-page">      
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="manage-plants-title">Plants Management</h2>
        <p className="manage-plants-subtitle">
          Add or remove plants. Default groups (admin, engineer, technician) are created automatically.
        </p>
        <div className="manage-plants-underline mx-auto" />
      </div>

      {/* Back Button */}
      <div className="mb-3">        
         <button
          className="btn btn-outline-light manage-back-btn"
          onClick={() => router.back()}
        >
          ⬅ Back to home menu
        </button>
      </div>
      
      {/* Add plant card */}
      <div className="card manage-plants-card mb-4 shadow-sm border-0">
        <div className="card-body">
          <h5 className="card-title mb-3">Add new plant</h5>
          <form onSubmit={handleAddPlant} className="manage-plants-add-form">
            <input
              type="text"
              className="form-control"
              placeholder="Plant name"
              value={newPlantName}
              onChange={(e) => setNewPlantName(e.target.value)}
              required
            />
            <button
              type="submit"
              className="btn btn-primary manage-plants-add-btn"
              disabled={adding}
            >
              {adding ? "Adding..." : "Add Plant"}
            </button>
          </form>
        </div>
      </div>

      {/* Plants list card */}
      <div className="card manage-plants-card shadow-sm border-0">
        <div className="card-body">
          <h5 className="card-title mb-3">Existing plants</h5>

          {loading && <p>Loading plants...</p>}
          {error && <p className="text-danger">{error}</p>}

          {!loading && !error && plants.length > 0 && (
            <div className="table-responsive">
              <table className="table table-striped align-middle manage-plants-table">
                <thead>
                  <tr>
                    <th>Plant name</th>
                    <th style={{ width: "80px" }} className="text-center">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {plants.map((plant) => (
                    <tr key={plant.entry_id}>
                      <td>{plant.plant_name}</td>
                      <td className="text-center">
                        <button
                          className="btn btn-outline-danger btn-sm manage-plants-delete-btn"
                          onClick={() => handleDeletePlant(plant)}
                          disabled={deletingId === plant.entry_id}
                          title="Delete plant"
                        >
                          {deletingId === plant.entry_id ? (
                            "..."
                          ) : (
                            <Image
                              src="/delete.svg"
                              alt="Delete"
                              width={18}
                              height={18}
                            />
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !error && plants.length === 0 && (
            <p>No plants found. Add the first one above.</p>
          )}
        </div>
      </div>      
    </div>
  );
};

export default ManagePlantsPage;
