import { deleteEmployee, activateEmployee } from "../api/employeeApi";

export default function EmployeeTable({ employees, onEdit, reload }) {
  return (
    <table border="1">
      <thead>
        <tr>
          <th>Code</th>
          <th>Name</th>
          <th>Dept</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>

      <tbody>
        {employees.map(emp => (
          <tr key={emp._id}>
            <td>{emp.employeeCode}</td>
            <td>{emp.employeeName}</td>
            <td>{emp.department}</td>
            <td>{emp.isActive ? "Active" : "Inactive"}</td>

            <td>
              <button onClick={() => onEdit(emp)}>Edit</button>

              {emp.isActive ? (
                <button onClick={async () => {
                  await deleteEmployee(emp._id);
                  reload();
                }}>Inactive</button>
              ) : (
                <button onClick={async () => {
                  await activateEmployee(emp._id);
                  reload();
                }}>Activate</button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}