"""
MCP Server Configuration Model
Stores configuration for Model Context Protocol servers
"""
from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime
from enum import Enum


class MCPTransportType(str, Enum):
    """Transport types for MCP connections"""
    COMMAND = "command"  # Local command-based (npx, uvx, etc.)
    HTTP = "streamable-http"  # Remote HTTP server
    SSE = "sse"  # Server-Sent Events


class MCPServerStatus(str, Enum):
    """Status of MCP server connection"""
    ACTIVE = "active"
    INACTIVE = "inactive"
    ERROR = "error"


class MCPServer(SQLModel, table=True):
    """MCP Server configuration model"""
    __tablename__ = "mcp_servers"

    id: Optional[int] = Field(default=None, primary_key=True)
    
    # Server identification
    name: str = Field(index=True, description="Unique name for the MCP server")
    description: Optional[str] = Field(default=None, description="Description of what this server does")
    
    # Connection configuration
    transport_type: str = Field(
        default=MCPTransportType.COMMAND.value,
        description="Transport type: 'command', 'streamable-http', or 'sse'"
    )
    
    # For command-based transport
    command: Optional[str] = Field(
        default=None, 
        description="Command to start the MCP server (e.g., 'npx -y @modelcontextprotocol/server-filesystem /path')"
    )
    
    # For HTTP/SSE transport
    url: Optional[str] = Field(
        default=None,
        description="URL for remote MCP server"
    )
    
    # Authentication (if needed)
    api_key: Optional[str] = Field(
        default=None,
        description="API key for authenticated MCP servers"
    )
    
    # Status
    status: str = Field(
        default=MCPServerStatus.INACTIVE.value,
        description="Current status of the server"
    )
    is_enabled: bool = Field(default=True, description="Whether this server is enabled")
    
    # Metadata
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    last_connected_at: Optional[datetime] = Field(default=None)
    error_message: Optional[str] = Field(default=None)
    
    # Tool information (cached after connection)
    available_tools: Optional[str] = Field(
        default=None, 
        description="JSON string of available tools from this server"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "name": "filesystem",
                "description": "Access to local filesystem",
                "transport_type": "command",
                "command": "npx -y @modelcontextprotocol/server-filesystem C:/Users/data",
                "status": "active",
                "is_enabled": True
            }
        }
