package com.woodsstudio.clover.apps;
import java.net.URI;
public final class NativePolicy {
 public static boolean https(String value){try{URI u=new URI(value);return "https".equalsIgnoreCase(u.getScheme())&&u.getHost()!=null&&u.getRawUserInfo()==null&&value.length()<8192;}catch(Exception e){return false;}}
 public static boolean packageId(String value){return value!=null&&value.matches("[A-Za-z][A-Za-z0-9_]*(\\.[A-Za-z][A-Za-z0-9_]*)+");}
 public static String filename(String value){String clean=value.replaceAll("[^a-zA-Z0-9._ -]","_");if(clean.length()>100)clean=clean.substring(0,100);return clean.isEmpty()?"download":clean;}
}
