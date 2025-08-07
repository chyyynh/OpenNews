"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle, XCircle, Clock, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface RSSRequest {
  id: string;
  url: string;
  sourceName: string;
  category?: string;
  description?: string;
  requestedBy: string;
  status: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export default function AdminRSSRequests() {
  const [requests, setRequests] = useState<RSSRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [adminNotes, setAdminNotes] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchRSSRequests();
  }, []);

  const fetchRSSRequests = async () => {
    try {
      const response = await fetch("/api/admin/rss-requests");
      if (response.ok) {
        const data = await response.json();
        setRequests(data);
      } else {
        toast.error("載入 RSS 申請失敗");
      }
    } catch (error) {
      console.error("Error fetching RSS requests:", error);
      toast.error("載入 RSS 申請時發生錯誤");
    } finally {
      setIsLoading(false);
    }
  };

  const updateRequestStatus = async (id: string, status: string, notes?: string) => {
    try {
      const response = await fetch(`/api/admin/rss-requests/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status,
          adminNotes: notes || adminNotes[id] || null,
        }),
      });

      if (response.ok) {
        toast.success(`申請已${status === 'approved' ? '核准' : '拒絕'}`);
        fetchRSSRequests(); // Refresh the list
        setAdminNotes(prev => ({ ...prev, [id]: '' })); // Clear notes
      } else {
        toast.error("更新狀態失敗");
      }
    } catch (error) {
      console.error("Error updating request:", error);
      toast.error("更新狀態時發生錯誤");
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />待審核</Badge>;
      case "approved":
        return <Badge variant="default" className="bg-green-500"><CheckCircle className="w-3 h-3 mr-1" />已核准</Badge>;
      case "rejected":
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />已拒絕</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">載入中...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">RSS 申請管理</h1>
        <p className="text-gray-600 mt-2">管理用戶提交的 RSS 來源申請</p>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="text-center py-8">
            <p className="text-gray-500">目前沒有 RSS 申請</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {requests.map((request) => (
            <Card key={request.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {request.sourceName}
                      {getStatusBadge(request.status)}
                    </CardTitle>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span>申請人: {request.requestedBy}</span>
                      <span>•</span>
                      <span>{new Date(request.createdAt).toLocaleDateString()}</span>
                      {request.category && (
                        <>
                          <span>•</span>
                          <span>分類: {request.category}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-1">RSS URL</h4>
                  <div className="flex items-center gap-2">
                    <code className="bg-gray-100 px-2 py-1 rounded text-sm flex-1">
                      {request.url}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(request.url, "_blank")}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {request.description && (
                  <div>
                    <h4 className="font-medium mb-1">描述</h4>
                    <p className="text-sm text-gray-700">{request.description}</p>
                  </div>
                )}

                {request.adminNotes && (
                  <div>
                    <h4 className="font-medium mb-1">管理員備註</h4>
                    <p className="text-sm text-gray-700 bg-yellow-50 p-2 rounded">
                      {request.adminNotes}
                    </p>
                  </div>
                )}

                {request.status === "pending" && (
                  <div className="space-y-3 pt-4 border-t">
                    <div>
                      <label className="block text-sm font-medium mb-1">
                        管理員備註（可選）
                      </label>
                      <Textarea
                        placeholder="添加備註或拒絕原因..."
                        value={adminNotes[request.id] || ""}
                        onChange={(e) =>
                          setAdminNotes((prev) => ({
                            ...prev,
                            [request.id]: e.target.value,
                          }))
                        }
                        className="text-sm"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => updateRequestStatus(request.id, "approved")}
                        className="bg-green-500 hover:bg-green-600"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        核准申請
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => updateRequestStatus(request.id, "rejected")}
                      >
                        <XCircle className="w-4 h-4 mr-2" />
                        拒絕申請
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}