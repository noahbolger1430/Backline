#!/usr/bin/env python3
"""
Script that takes a list of relative file paths and outputs a string where
the contents of each file are concatenated together in a specific format.
"""

import os
import sys
import io
from pathlib import Path

# Handle Unicode output on Windows
if sys.platform == 'win32':
    # Reconfigure stdout to use UTF-8 encoding
    if hasattr(sys.stdout, 'buffer'):
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')


def get_language_from_extension(file_path: str) -> str:
    """
    Determine the language identifier from file extension.
    
    Args:
        file_path: The path to the file
        
    Returns:
        Language identifier string (e.g., 'python', 'javascript', 'typescript')
    """
    extension_map = {
        '.py': 'python',
        '.js': 'javascript',
        '.jsx': 'javascript',
        '.ts': 'typescript',
        '.tsx': 'typescript',
        '.java': 'java',
        '.cpp': 'cpp',
        '.c': 'c',
        '.cs': 'csharp',
        '.go': 'go',
        '.rs': 'rust',
        '.rb': 'ruby',
        '.php': 'php',
        '.swift': 'swift',
        '.kt': 'kotlin',
        '.scala': 'scala',
        '.r': 'r',
        '.sql': 'sql',
        '.html': 'html',
        '.css': 'css',
        '.scss': 'scss',
        '.sass': 'sass',
        '.less': 'less',
        '.json': 'json',
        '.xml': 'xml',
        '.yaml': 'yaml',
        '.yml': 'yaml',
        '.toml': 'toml',
        '.ini': 'ini',
        '.md': 'markdown',
        '.sh': 'bash',
        '.bash': 'bash',
        '.zsh': 'zsh',
        '.ps1': 'powershell',
        '.bat': 'batch',
        '.cmd': 'batch',
    }
    
    ext = Path(file_path).suffix.lower()
    return extension_map.get(ext, 'text')


def concatenate_files(file_paths: list[str]) -> str:
    """
    Concatenate the contents of multiple files into a formatted string.
    
    Args:
        file_paths: List of relative file paths
        
    Returns:
        Formatted string with all file contents
    """
    result_parts = []
    
    for file_path in file_paths:
        # Read file contents
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                contents = f.read()
        except FileNotFoundError:
            contents = f"# Error: File not found: {file_path}"
        except UnicodeDecodeError:
            # Try reading as binary if UTF-8 fails
            try:
                with open(file_path, 'r', encoding='latin-1') as f:
                    contents = f.read()
            except Exception as e:
                contents = f"# Error: Could not read file {file_path}: {e}"
        except Exception as e:
            contents = f"# Error: Could not read file {file_path}: {e}"
        
        # Get language identifier
        language = get_language_from_extension(file_path)
        
        # Format the output
        result_parts.append(f"{file_path}\n```{language}\n{contents}\n```")
    
    return "\n\n".join(result_parts)


def main():
    """
    Main function for command-line usage.
    """
    if len(sys.argv) < 2:
        print("Usage: python concatenate_files.py <file1> [file2] [file3] ...", file=sys.stderr)
        sys.exit(1)
    
    file_paths = sys.argv[1:]
    result = concatenate_files(file_paths)
    print(result)


if __name__ == "__main__":
    main()


