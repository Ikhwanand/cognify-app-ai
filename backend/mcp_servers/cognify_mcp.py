import subprocess
import ast
from pathlib import Path
from mcp.server.fastmcp import FastMCP

# Create the MCP server
mcp = FastMCP(name="Cognify-Tools-MCP")

# Set up dedicated workspace directory outside backend to prevent Uvicorn reload
WORKSPACE_DIR = Path(__file__).parent.parent.parent / "agent_workspace"
WORKSPACE_DIR.mkdir(parents=True, exist_ok=True)

# --- DATA ANALYST TOOLS ---


@mcp.tool("execute_python")
def execute_python(code: str) -> str:
    """Execute Python code in a safe subprocess.
    Ideal for calculation, data manipulation (Pandas), or quick scripting.
    Returns the standard output and standard error.
    """
    try:
        # Check if the code parses validly
        ast.parse(code)
    except Exception as e:
        return f"SyntaxError in code: {e}"

    import sys
    import uuid

    temp_file_path = WORKSPACE_DIR / f"temp_script_{uuid.uuid4().hex}.py"
    try:
        temp_file_path.write_text(code, encoding="utf-8")

        result = subprocess.run(
            [sys.executable, str(temp_file_path)],
            cwd=str(WORKSPACE_DIR),
            capture_output=True,
            text=True,
            timeout=30,  # 30 seconds timeout
            stdin=subprocess.DEVNULL,
        )
        output = result.stdout
        if result.stderr:
            output += f"\n[Errors/Warnings]:\n{result.stderr}"

        if not output.strip() and result.returncode == 0:
            output = "Code executed successfully with no output."

        return output
    except subprocess.TimeoutExpired:
        return "Error: Code execution timed out after 30 seconds."
    except Exception as e:
        return f"Error executing code: {e}"
    finally:
        try:
            if temp_file_path.exists():
                temp_file_path.unlink()
        except Exception:
            pass


# --- SOFTWARE ENGINEER TOOLS ---


@mcp.tool("run_terminal_command")
def run_terminal_command(command: str, cwd: str = ".") -> str:
    """Run a terminal command (shell). Ideal for installing packages, git operations, and running scripts.
    Returns the output from the command line. Use safely.
    """
    try:
        target_cwd = Path(cwd)
        if not target_cwd.is_absolute():
            target_cwd = WORKSPACE_DIR / cwd

        result = subprocess.run(
            command,
            shell=True,
            cwd=str(target_cwd),
            capture_output=True,
            text=True,
            timeout=60,
            stdin=subprocess.DEVNULL,
        )
        output = result.stdout
        if result.stderr:
            output += f"\n[Errors/Warnings]:\n{result.stderr}"

        if not output.strip() and result.returncode == 0:
            output = f"Command '{command}' executed successfully."

        return output
    except subprocess.TimeoutExpired:
        return f"Error: Command '{command}' timed out after 60 seconds."
    except Exception as e:
        return f"Error executing command: {e}"


@mcp.tool("fs_read_file")
def fs_read_file(filepath: str) -> str:
    """Read contents of a file from the filesystem."""
    try:
        path = Path(filepath)
        if not path.is_absolute():
            path = WORKSPACE_DIR / path

        if not path.exists():
            return f"Error: File not found at {path}"
        if not path.is_file():
            return f"Error: Path is not a file {path}"

        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        return f"Error reading file: {e}"


@mcp.tool("fs_write_file")
def fs_write_file(filepath: str, content: str) -> str:
    """Write contents to a file on the filesystem. Overwrites the file if it exists."""
    try:
        path = Path(filepath)
        if not path.is_absolute():
            path = WORKSPACE_DIR / path

        path.parent.mkdir(parents=True, exist_ok=True)

        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return f"Successfully wrote to {path}"
    except Exception as e:
        return f"Error writing file: {e}"


@mcp.tool("fs_list_directory")
def fs_list_directory(directory: str = ".") -> str:
    """List files and folders in a directory."""
    try:
        path = Path(directory)
        if not path.is_absolute():
            path = WORKSPACE_DIR / path

        if not path.exists() or not path.is_dir():
            return f"Error: Directory not found {path}"

        items = []
        for x in path.iterdir():
            if x.is_dir():
                items.append(f"[DIR]  {x.name}")
            else:
                items.append(f"[FILE] {x.name} ({x.stat().st_size} bytes)")

        return "\n".join(items) if items else "Directory is empty."
    except Exception as e:
        return f"Error listing directory: {e}"


if __name__ == "__main__":
    # For testing, you can use built-in MCP server features like 'fastmcp run cognify_mcp.py'
    mcp.run(transport="stdio")
