"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  LogOut,
  RefreshCw,
  Users,
  Activity,
  Clock,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  UserCog,
  BarChart3,
} from "lucide-react"

export default function AdminPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const { user, logout, token } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
      router.push("/")
    }
  }, [user, loading, router])

  useEffect(() => {
    if (user?.role === "admin" && token) {
      fetchData()
      const interval = setInterval(fetchData, 30000)
      return () => clearInterval(interval)
    }
  }, [user, token])

  const fetchData = async () => {
    if (!token) return

    try {
      const response = await fetch("/api/admin/overview", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const result = await response.json()
        setData(result)
        setLastRefresh(new Date())
        setError("")
      } else {
        setError("Failed to fetch data")
      }
    } catch (error) {
      setError("Network error")
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
    router.push("/")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  if (!user || user.role !== "admin") {
    return null
  }

  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <div className="text-red-600 mb-4">
              <AlertCircle className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Connection Error</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={fetchData} className="w-full">
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <UserCog className="h-6 w-6 text-blue-600" />
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Admin Dashboard</h1>
                <p className="text-sm text-gray-600">{user.name} • System Administrator</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right text-sm text-gray-500">
                <div>Last updated</div>
                <div>{lastRefresh.toLocaleTimeString()}</div>
              </div>
              <Button onClick={fetchData} variant="outline" size="sm" disabled={loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
              <Button onClick={handleLogout} variant="outline" size="sm">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Overview Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Patients</p>
                  <p className="text-3xl font-bold text-gray-900">{data?.overview?.totalPatients || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">Today</p>
                </div>
                <Users className="h-10 w-10 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Waiting</p>
                  <p className="text-3xl font-bold text-orange-600">{data?.overview?.waitingPatients || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">In queue</p>
                </div>
                <Clock className="h-10 w-10 text-orange-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completed</p>
                  <p className="text-3xl font-bold text-green-600">{data?.overview?.completedPatients || 0}</p>
                  <p className="text-xs text-gray-500 mt-1">Today</p>
                </div>
                <CheckCircle className="h-10 w-10 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Wait Time</p>
                  <p className="text-3xl font-bold text-blue-600">{data?.overview?.averageWaitTime || 0}m</p>
                  <p className="text-xs text-gray-500 mt-1">Per patient</p>
                </div>
                <TrendingUp className="h-10 w-10 text-blue-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Priority Breakdown */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Priority Breakdown
            </CardTitle>
            <CardDescription>Patient distribution by priority level</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-red-800">Emergency</p>
                    <p className="text-2xl font-bold text-red-900">{data?.priorityBreakdown?.emergency || 0}</p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-red-600" />
                </div>
              </div>

              <div className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-800">Urgent</p>
                    <p className="text-2xl font-bold text-orange-900">{data?.priorityBreakdown?.urgent || 0}</p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-orange-600" />
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-800">Normal</p>
                    <p className="text-2xl font-bold text-blue-900">{data?.priorityBreakdown?.normal || 0}</p>
                  </div>
                  <Activity className="h-8 w-8 text-blue-600" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tabs for detailed views */}
        <Tabs defaultValue="chambers" className="space-y-6">
          <TabsList>
            <TabsTrigger value="chambers">Chamber Statistics</TabsTrigger>
            <TabsTrigger value="staff">Staff Management</TabsTrigger>
            <TabsTrigger value="patients">Recent Patients</TabsTrigger>
          </TabsList>

          <TabsContent value="chambers">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Chamber Performance
                </CardTitle>
                <CardDescription>Real time statistics for each chamber</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {data?.chamberStats?.map((chamber) => (
                    <div key={chamber.chamberNumber} className="p-4 bg-gray-50 rounded-lg border">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <h3 className="font-semibold text-lg">Chamber {chamber.department ? chamber.chamberNumber : chamber.chamberNumber}</h3>
                          <p className="text-sm text-gray-600">{chamber.department}</p>
                        </div>
                        <Badge variant="outline">{chamber.totalPatients} patients</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-gray-600">Completed</p>
                          <p className="font-semibold text-green-600">{chamber.completedPatients}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Waiting</p>
                          <p className="font-semibold text-orange-600">{chamber.waitingPatients}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Avg Time</p>
                          <p className="font-semibold text-blue-600">{chamber.averageTime}m</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="staff">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Staff Directory
                </CardTitle>
                <CardDescription>Manage hospital staff and their assignments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data?.staff?.map((member) => (
                    <div key={member.id} className="p-4 bg-gray-50 rounded-lg border flex justify-between items-center">
                      <div>
                        <h3 className="font-semibold">{member.name}</h3>
                        <p className="text-sm text-gray-600">
                          {member.role} • {member.department}
                          {member.chamberNumber ? ` • Chamber ${member.chamberNumber}` : ""}
                        </p>
                      </div>
                      <Badge variant={member.isActive ? "default" : "secondary"}>
                        {member.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="patients">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Patients
                </CardTitle>
                <CardDescription>Latest patient registrations and updates</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data?.recentPatients?.map((patient) => (
                    <div key={patient._id} className="p-4 bg-gray-50 rounded-lg border">
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-semibold">
                            #{patient.tokenNumber} - {patient.name}
                          </h3>
                          <p className="text-sm text-gray-600">
                            {patient.age} years • Chamber {patient.chamber} • {patient.sickness}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            Registered: {new Date(patient.registeredAt).toLocaleString()}
                          </p>
                        </div>
                        <Badge
                          variant={
                            patient.status === "completed"
                              ? "default"
                              : patient.status === "in-progress"
                              ? "secondary"
                              : "outline"
                          }
                        >
                          {patient.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Auto-refresh indicator */}
        <div className="text-center mt-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
            Auto refreshing every 30 seconds
          </div>
        </div>
      </div>
    </div>
  )
}
