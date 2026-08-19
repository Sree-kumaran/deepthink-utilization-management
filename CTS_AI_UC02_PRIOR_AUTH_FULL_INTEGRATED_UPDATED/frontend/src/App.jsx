import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";
import RoleRoute from "./components/RoleRoute";
import { ROLES, useRole } from "./context/RoleContext";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import NewAuthorization from "./pages/NewAuthorization";
import Requests from "./pages/Requests";
import NurseReview from "./pages/NurseReview";
import Policies from "./pages/Policies";
import AuditTrail from "./pages/AuditTrail";
import Settings from "./pages/Settings";
import AuthorizationDetail from "./pages/AuthorizationDetail";
import ExtractionResult from "./pages/ExtractionResult";
import PolicyEvaluation from "./pages/PolicyEvaluation";
import Decision from "./pages/Decision";
import DecisionTrace from "./pages/DecisionTrace";
import RequestMoreInformation from "./pages/RequestMoreInformation";
import ProviderResponse from "./pages/ProviderResponse";
import PostSubmissionReview from "./pages/PostSubmissionReview";

const Insurer = ({ children }) => <RoleRoute allowedRole={ROLES.INSURER}>{children}</RoleRoute>;
const Provider = ({ children }) => <RoleRoute allowedRole={ROLES.PROVIDER}>{children}</RoleRoute>;
const InsurerOrProvider = ({ children }) => {
  const { role } = useRole();
  return role === ROLES.INSURER || role === ROLES.PROVIDER ? children : <Navigate to="/dashboard" replace />;
};

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route element={<MainLayout />}>
          <Route path="/dashboard" element={<Insurer><Dashboard /></Insurer>} />
          <Route path="/policies" element={<Insurer><Policies /></Insurer>} />
          <Route path="/audit-trail" element={<Insurer><AuditTrail /></Insurer>} />
          <Route path="/new-authorization" element={<Provider><NewAuthorization /></Provider>} />
          <Route path="/requests" element={<Provider><Requests /></Provider>} />
          <Route path="/nurse-review" element={<Insurer><NurseReview /></Insurer>} />
          <Route path="/nurse-review/:id" element={<Insurer><NurseReview /></Insurer>} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/authorization/:id" element={<InsurerOrProvider><AuthorizationDetail /></InsurerOrProvider>} />
          <Route path="/extraction-result" element={<ExtractionResult />} />
          <Route path="/extraction-result/:id" element={<ExtractionResult />} />
          <Route path="/policy-evaluation/:id" element={<PolicyEvaluation />} />
          <Route path="/policy-evaluation" element={<PolicyEvaluation />} />
          <Route path="/decision" element={<Decision />} />
          <Route path="/decision/:id" element={<Decision />} />
          <Route path="/decision-trace/:id" element={<InsurerOrProvider><DecisionTrace /></InsurerOrProvider>} />
          <Route path="/decision-trace" element={<InsurerOrProvider><DecisionTrace /></InsurerOrProvider>} />
          <Route path="/request-information" element={<RequestMoreInformation />} />
          <Route path="/provider-response" element={<ProviderResponse />} />
          <Route path="/post-submission-review" element={<PostSubmissionReview />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
