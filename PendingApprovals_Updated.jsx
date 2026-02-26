import React, { useMemo, useState, useEffect } from "react";
import { Box, Button, InputBase, useMediaQuery, useTheme } from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import SearchIcon from "@mui/icons-material/Search";
import { tokens } from "../../../theme";
import axiosInstance from "../../../utils/axiosInstance";

const PendingApprovals = () => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("md"));
  const [filter, setFilter] = useState("");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch data from API
  useEffect(() => {
    const fetchPendingApprovals = async () => {
      try {
        setLoading(true);
        const response = await axiosInstance.get('/handsets/pending-approvals');
        setData(response.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching pending approvals:', err);
        setError('Failed to load pending approvals');
        // Fallback to mock data if API fails
        setData([
          { id: 1, RequestNumber: "HR-0001", Employee: "EMP001", Type: "New", Amount: 4500, WithinLimit: true, Status: "Submitted" },
          { id: 2, RequestNumber: "HR-0002", Employee: "EMP245", Type: "Renewal", Amount: 7200, WithinLimit: false, Status: "Limit Checked", Excess: 1200 },
          { id: 3, RequestNumber: "HR-0003", Employee: "EMP781", Type: "New", Amount: 3800, WithinLimit: true, Status: "Device Located" },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchPendingApprovals();
  }, []);

  const filtered = useMemo(() => {
    if (!filter) return data;
    const q = filter.toLowerCase();
    return data.filter(
      (r) => 
        r.RequestNumber.toLowerCase().includes(q) || 
        r.Employee.toLowerCase().includes(q) ||
        (r.EmployeeName && r.EmployeeName.toLowerCase().includes(q))
    );
  }, [data, filter]);

  const columns = [
    { field: "RequestNumber", headerName: "Request #", width: 140 },
    { field: "Employee", headerName: "Employee Code", width: 120 },
    { field: "EmployeeName", headerName: "Employee Name", width: 180 },
    { field: "Type", headerName: "Type", width: 110 },
    { field: "Amount", headerName: "Amount", width: 120, valueFormatter: (p) => `N$ ${p.value?.toLocaleString?.()}` },
    { field: "AccessFee", headerName: "Access Fee", width: 120, valueFormatter: (p) => `N$ ${p.value?.toLocaleString?.()}` },
    { field: "WithinLimit", headerName: "Within Limit", width: 130, valueFormatter: (p) => (p.value ? "Yes" : "No") },
    { field: "Excess", headerName: "Excess", width: 120, valueFormatter: (p) => (p.value ? `N$ ${p.value}` : "-") },
    { field: "Status", headerName: "Status", width: 160 },
    { 
      field: "IsRenewalDue", 
      headerName: "Renewal Due", 
      width: 130, 
      valueFormatter: (p) => p.value ? "⚠️ Due Soon" : "-",
      cellClassName: (params) => params.value ? 'renewal-due' : ''
    },
    { field: "Department", headerName: "Department", width: 150 },
    { field: "HandsetName", headerName: "Device", width: 180 },
  ];

  const handleRefresh = async () => {
    try {
      setLoading(true);
      const response = await axiosInstance.get('/handsets/pending-approvals');
      setData(response.data);
      setError(null);
    } catch (err) {
      console.error('Error refreshing data:', err);
      setError('Failed to refresh data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box m="2px" display="flex" justifyContent="center" alignItems="center" height="400px">
        <div>Loading pending approvals...</div>
      </Box>
    );
  }

  return (
    <Box m="2px">
      <div
        style={{
          height: 520,
          width: "98%",
          marginLeft: "auto",
          marginRight: "auto",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
          <Box
            className="d-flex col-md-5"
            display="flex"
            backgroundColor={colors.primary[400]}
            borderRadius="3px"
            width="260px"
          >
            <InputBase
              sx={{ ml: 2, flex: 1 }}
              placeholder="Search by Request # or Employee"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <Button type="button" sx={{ p: 1, minWidth: 0 }}>
              <SearchIcon />
            </Button>
          </Box>
          
          <Button
            onClick={handleRefresh}
            variant="contained"
            sx={{
              backgroundColor: colors.blueAccent[600],
              color: "white",
              "&:hover": {
                backgroundColor: colors.blueAccent[700],
              },
            }}
          >
            Refresh
          </Button>
        </div>

        {error && (
          <Box 
            sx={{ 
              backgroundColor: colors.redAccent[500], 
              color: "white", 
              padding: "10px", 
              borderRadius: "4px", 
              marginBottom: "10px" 
            }}
          >
            {error}
          </Box>
        )}

        <Box
          m="20px 0 0 0"
          height="55vh"
          sx={{
            "& .MuiDataGrid-root": { border: "none" },
            "& .MuiDataGrid-cell": { borderBottom: "none" },
            "& .MuiDataGrid-columnHeaders": { backgroundColor: colors.grey[900], borderBottom: "none" },
            "& .MuiDataGrid-virtualScroller": { backgroundColor: colors.primary[400] },
            "& .MuiDataGrid-footerContainer": { borderTop: "none", backgroundColor: colors.grey[900] },
            "& .renewal-due": { 
              backgroundColor: colors.redAccent[100], 
              color: colors.redAccent[600],
              fontWeight: "bold"
            },
          }}
        >
          <DataGrid 
            rows={filtered} 
            columns={columns} 
            pageSize={5} 
            rowsPerPageOptions={[5, 10, 20]}
            loading={loading}
            disableSelectionOnClick
          />
        </Box>
      </div>
    </Box>
  );
};

export default PendingApprovals;
