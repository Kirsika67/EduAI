import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import AcceptInvitePage from './pages/AcceptInvitePage'
import PaevikPage from './pages/PaevikPage'
import VeelPage from './pages/VeelPage'
import LandingPage from './pages/LandingPage'
import AutomationsPage from './pages/AutomationsPage'
import PlannerPage from './pages/PlannerPage'
import ProfilePage from './pages/ProfilePage'
import TeraPage from './pages/TeraPage'
import OverviewPage from './pages/OverviewPage'
import StudentsPage from './pages/StudentsPage'
import StudentDetailPage from './pages/StudentDetailPage'
import GradeEntryPage from './pages/GradeEntryPage'
import ClassesPage from './pages/ClassesPage'
import MaterialsPage from './pages/MaterialsPage'
import FeedbackPage from './pages/FeedbackPage'
import PlanningPage from './pages/PlanningPage'
import SchoolMembersPage from './pages/SchoolMembersPage'
import EssayGradingPage from './pages/EssayGradingPage'
import InvitePage from './pages/InvitePage'
import SettingsPage from './pages/SettingsPage'
import TimetablePage from './pages/TimetablePage'
import ParentMeetingsPage from './pages/ParentMeetingsPage'
import AttendancePage from './pages/AttendancePage'
import MessagesPage from './pages/MessagesPage'
import MentoringPage from './pages/MentoringPage'
import SchoolPage from './pages/SchoolPage'
import ActivitiesPage from './pages/ActivitiesPage'
import MyChildPage from './pages/MyChildPage'
import { isStaff, isLeadership, canInvite, landingPathForRole } from './constants/roles'

function Loading() {
  return <div className="flex items-center justify-center h-screen text-gray-500">Laadin...</div>
}

function PrivateRoute({ children }) {
  const { teacher, loading } = useAuth()
  if (loading) return <Loading />
  if (!teacher) return <Navigate to="/avaleht" replace />
  return children
}

function PublicRoute({ children }) {
  const { teacher, loading } = useAuth()
  if (loading) return <Loading />
  if (teacher) return <Navigate to={landingPathForRole(teacher.role)} replace />
  return children
}

/** Maandumine rolli järgi — vanem ja õpilane ei satu õpetaja Ülevaate lehele. */
function HomeRedirect() {
  const { role } = useAuth()
  return <Navigate to={landingPathForRole(role)} replace />
}

/**
 * Rollivärav. Frontend peidab ainult UI-d — päris keeld on backendis (RULE R1).
 * Sellepärast piisab siin ümbersuunamisest, ilma veateateta.
 */
function RoleGate({ allow }) {
  const { role, loading } = useAuth()
  if (loading) return <Loading />
  if (!allow(role)) return <Navigate to={landingPathForRole(role)} replace />
  return <Outlet />
}

export default function App() {
  return (
    <Routes>
      <Route path="/avaleht" element={<PublicRoute><LandingPage /></PublicRoute>} />
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/kutse/:token" element={<AcceptInvitePage />} />

      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<HomeRedirect />} />

        {/* Koolitöötaja lehed */}
        <Route element={<RoleGate allow={isStaff} />}>
          <Route path="planeerija" element={<PlannerPage />} />
          <Route path="automatsioonid" element={<AutomationsPage />} />
          <Route path="paevik" element={<PaevikPage />} />
          <Route path="tera" element={<TeraPage />} />
          <Route path="ulevaade" element={<OverviewPage />} />
          <Route path="opilased" element={<StudentsPage />} />
          <Route path="opilased/:studentId" element={<StudentDetailPage />} />
          <Route path="kohalolek" element={<AttendancePage />} />
          <Route path="hinded" element={<GradeEntryPage />} />
          <Route path="klassid" element={<ClassesPage />} />
          <Route path="materjalid" element={<MaterialsPage />} />
          <Route path="tagasiside" element={<FeedbackPage />} />
          <Route path="planeerimine" element={<PlanningPage />} />
        <Route path="esseede-hindamine" element={<EssayGradingPage />} />
        <Route path="kooli-liikmed" element={<SchoolMembersPage />} />
          <Route path="seaded" element={<SettingsPage />} />
          <Route path="mentorlus" element={<MentoringPage />} />
        </Route>

        {/* Kogu kooli vaade — ainult juhtkond */}
        <Route element={<RoleGate allow={isLeadership} />}>
          <Route path="kool" element={<SchoolPage />} />
        </Route>

        {/* Kutsete haldus — klassijuhataja, õppealajuhataja, direktor */}
        <Route element={<RoleGate allow={canInvite} />}>
          <Route path="kutsu" element={<InvitePage />} />
        </Route>

        {/* Tunniplaan — vaatavad kõik rollid, muudavad ainult töötajad (backend valvab) */}
        <Route path="tunniplaan" element={<TimetablePage />} />
        <Route path="tunniplaan/vanemapaev" element={<ParentMeetingsPage />} />
        <Route path="sonumid" element={<MessagesPage />} />
        <Route path="huviringid" element={<ActivitiesPage />} />

        {/* Vanema ja õpilase vaade */}
        <Route path="profiil" element={<ProfilePage />} />
        <Route path="veel" element={<VeelPage />} />
        <Route path="minu-laps" element={<MyChildPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
